import { describe, expect, it } from 'vitest';
import { parseGeminiReceiptResponse } from './receiptParser';

const noCharge = { enabled: null, amount: null, percent: null, confidence: null, source: null };

function modelText(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    items: [{ description: '  Chicken   rice ', amount: 5.456 }],
    subtotal: 5.46,
    total: 5.46,
    detected: { gst: noCharge, serviceCharge: noCharge },
    warnings: [],
    ...overrides,
  });
}

describe('parsing a Gemini receipt', () => {
  it('tidies the description and rounds the amount', () => {
    const result = parseGeminiReceiptResponse(modelText());
    expect(result.items).toEqual([{ description: 'Chicken rice', amount: 5.46 }]);
  });

  it('warns when no line item survives', () => {
    const result = parseGeminiReceiptResponse(
      modelText({ items: [{ description: null, amount: 3 }] }),
    );
    expect(result.items).toEqual([]);
    expect(result.warnings).toEqual([
      'Gemini did not return line items confidently. Add/edit items manually.',
    ]);
  });

  it('turns a charge with a percent into an enabled detection named after Gemini', () => {
    const gst = { ...noCharge, percent: 9, confidence: 4 };
    const result = parseGeminiReceiptResponse(
      modelText({ detected: { gst, serviceCharge: noCharge } }),
    );
    expect(result.detected.gst).toEqual({
      enabled: true,
      amount: null,
      percent: 9,
      confidence: 1,
      source: 'gemini',
    });
    expect(result.detected.serviceCharge.source).toBe('none');
  });

  it('refuses text that is not JSON', () => {
    expect(() => parseGeminiReceiptResponse('nope')).toThrow('Gemini output was not valid JSON.');
  });

  it('refuses JSON of the wrong shape', () => {
    expect(() => parseGeminiReceiptResponse('{"items": 3}')).toThrow(
      'Gemini response did not match expected schema.',
    );
  });
});
