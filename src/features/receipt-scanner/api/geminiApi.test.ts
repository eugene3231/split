import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeReceiptWithGemini } from './geminiApi';

function createFile(): File {
  return new File(['receipt-bytes'], 'receipt.jpg', { type: 'image/jpeg' });
}

function stubFetch(candidatesText: string | null) {
  const body =
    candidatesText === null
      ? ''
      : JSON.stringify({ candidates: [{ content: { parts: [{ text: candidatesText }] } }] });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(body),
    }),
  );
}

function stubFetchApiError(message: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: vi.fn().mockResolvedValue(JSON.stringify({ error: { message } })),
    }),
  );
}

function stubFetchNetworkError(message: string) {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error(message)));
}

describe('analyzeReceiptWithGemini', () => {
  it('throws explicit errors when api key or model is missing', async () => {
    await expect(
      analyzeReceiptWithGemini(createFile(), '', 'gemini-2.5-flash', vi.fn()),
    ).rejects.toThrow('Missing Gemini API key. Enter it above.');

    await expect(analyzeReceiptWithGemini(createFile(), 'abc', ' ', vi.fn())).rejects.toThrow(
      'Missing Gemini model selection.',
    );
  });

  it('throws when Gemini response is empty or not parseable', async () => {
    stubFetch(null);
    await expect(
      analyzeReceiptWithGemini(createFile(), 'abc', 'gemini-2.5-flash', vi.fn()),
    ).rejects.toThrow('Gemini returned an empty response.');

    stubFetch('not-json');
    await expect(
      analyzeReceiptWithGemini(createFile(), 'abc', 'gemini-2.5-flash', vi.fn()),
    ).rejects.toThrow('Gemini output was not valid JSON.');
  });

  it('propagates Gemini API errors', async () => {
    stubFetchApiError('Invalid API key');

    await expect(
      analyzeReceiptWithGemini(createFile(), 'abc', 'gemini-2.5-flash', vi.fn()),
    ).rejects.toThrow('Invalid API key');
  });

  it('throws when fetch itself fails', async () => {
    stubFetchNetworkError('Network error');

    await expect(
      analyzeReceiptWithGemini(createFile(), 'abc', 'gemini-2.5-flash', vi.fn()),
    ).rejects.toThrow('Network error');
  });

  it('parses valid Gemini output into normalized OCR payload', async () => {
    const statuses: string[] = [];
    stubFetch(
      JSON.stringify({
        items: [
          { description: '  Chicken Rice  ', amount: 8.5 },
          { description: '', amount: 3.2 },
        ],
        subtotal: 8.5,
        total: 9.27,
        detected: {
          gst: { enabled: false, amount: null, percent: 9, confidence: 1.4, source: null },
          serviceCharge: {
            enabled: true,
            amount: null,
            percent: 10,
            confidence: 0.8,
            source: 'receipt',
          },
        },
        warnings: ['Low confidence'],
      }),
    );

    const result = await analyzeReceiptWithGemini(
      createFile(),
      'abc',
      'gemini-2.5-flash',
      (status) => statuses.push(status),
    );

    expect(statuses).toEqual([
      'Encoding receipt...',
      'Calling Gemini...',
      'Parsing Gemini output...',
    ]);
    expect(result.items).toEqual([{ description: 'Chicken Rice', amount: 8.5 }]);
    expect(result.subtotal).toBe(8.5);
    expect(result.total).toBe(9.27);
    expect(result.detected.gst).toEqual({
      enabled: true,
      amount: null,
      percent: 9,
      confidence: 1,
      source: 'gemini',
    });
    expect(result.detected.serviceCharge).toEqual({
      enabled: true,
      amount: null,
      percent: 10,
      confidence: 0.8,
      source: 'receipt',
    });
    expect(result.warnings).toEqual(['Low confidence']);
  });

  it('adds fallback warning when no line items are returned', async () => {
    stubFetch(
      JSON.stringify({
        items: [],
        subtotal: null,
        total: null,
        detected: {
          gst: { enabled: null, amount: null, percent: null, confidence: null, source: null },
          serviceCharge: {
            enabled: null,
            amount: null,
            percent: null,
            confidence: null,
            source: null,
          },
        },
        warnings: [],
      }),
    );

    const result = await analyzeReceiptWithGemini(createFile(), 'abc', 'gemini-2.5-flash', vi.fn());
    expect(result.items).toEqual([]);
    expect(result.warnings).toContain(
      'Gemini did not return line items confidently. Add/edit items manually.',
    );
  });

  it('throws when Gemini response has no candidates/content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(JSON.stringify({ candidates: [] })),
      }),
    );

    await expect(
      analyzeReceiptWithGemini(createFile(), 'abc', 'gemini-2.5-flash', vi.fn()),
    ).rejects.toThrow('Gemini response did not include extractable content.');
  });

  it('throws when Gemini returns valid JSON that does not match the receipt schema', async () => {
    stubFetch(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ random: 'data' }) }] } }],
      }),
    );

    await expect(
      analyzeReceiptWithGemini(createFile(), 'abc', 'gemini-2.5-flash', vi.fn()),
    ).rejects.toThrow('Gemini response did not match expected schema.');
  });

  it('throws when Gemini response body is not valid JSON at all', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('this is not json'),
      }),
    );

    await expect(
      analyzeReceiptWithGemini(createFile(), 'abc', 'gemini-2.5-flash', vi.fn()),
    ).rejects.toThrow('Gemini returned non-JSON response.');
  });
});

describe('fileToBase64 error handling', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects when FileReader fires an error', async () => {
    vi.stubGlobal(
      'FileReader',
      class {
        onerror: (() => void) | null = null;
        onload: (() => void) | null = null;
        readAsDataURL() {
          Promise.resolve().then(() => this.onerror?.());
        }
      },
    );

    await expect(
      analyzeReceiptWithGemini(createFile(), 'abc', 'gemini-2.5-flash', vi.fn()),
    ).rejects.toThrow('Failed to read receipt file');
  });
});
