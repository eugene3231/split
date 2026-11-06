import { afterEach, describe, expect, it, vi } from 'vitest';
import { JPEG, PDF, startHarness } from '../../test/harness';
import type { Harness } from '../../test/harness';
import { countsOn } from '../../test/testDb';
import { STUB_RECEIPT } from '../../test/stubGemini';

let harness: Harness;
afterEach(() => harness.close());

const TODAY = '2026-10-31';

function deviceCount(h: Harness): number {
  const counts = countsOn(h.db, TODAY);
  return Object.entries(counts)
    .filter(([key]) => key.startsWith('scan:device|'))
    .reduce((sum, [, count]) => sum + count, 0);
}

function globalCount(h: Harness): number {
  return countsOn(h.db, TODAY)['scan:global|'] ?? 0;
}

function streamOf(...chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

function streamThatStalls(first: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(first);
    },
  });
}

describe('POST /api/v1/scan, a good photo', () => {
  it('returns the receipt for a JPEG', async () => {
    harness = await startHarness();
    const token = await harness.mintToken();
    const response = await harness.scan(token, JPEG);
    expect(response.status).toBe(200);
    const { receipt } = (await response.json()) as { receipt: typeof STUB_RECEIPT };
    expect(receipt.items).toEqual(STUB_RECEIPT.items);
    expect(receipt.detected.gst.percent).toBe(9);
    expect(harness.stub.requests()).toBe(1);
  });

  it('returns the receipt for a PDF', async () => {
    harness = await startHarness();
    const token = await harness.mintToken();
    const response = await harness.scan(token, PDF, 'application/pdf');
    expect(response.status).toBe(200);
  });

  it('sends the server key and the configured model to Gemini', async () => {
    harness = await startHarness({ SCAN_MODEL: 'gemini-3.5-flash' });
    const token = await harness.mintToken();
    await harness.scan(token, JPEG);
    expect(harness.stub.lastRequest()).toEqual({
      url: '/v1beta/models/gemini-3.5-flash:generateContent',
      apiKey: 'test-gemini-key',
    });
  });
});

describe('POST /api/v1/scan, who is asking', () => {
  it('answers needs-device with no pass and with a made-up pass, without calling Gemini', async () => {
    harness = await startHarness();
    for (const token of [null, 'made-up']) {
      const response = await harness.scan(token, JPEG);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ kind: 'needs-device' });
    }
    expect(harness.stub.requests()).toBe(0);
  });

  it('answers needs-device for an Authorization header that is not a bearer token', async () => {
    harness = await startHarness();
    const response = await harness.app.request('/api/v1/scan', {
      method: 'POST',
      headers: { Authorization: 'Basic abc', 'Content-Type': 'image/jpeg' },
      body: JPEG,
    });
    expect(response.status).toBe(401);
  });
});

describe('POST /api/v1/scan, a bad photo', () => {
  it('answers 415 for a type outside the list', async () => {
    harness = await startHarness();
    const token = await harness.mintToken();
    const response = await harness.scan(token, 'hello', 'text/plain');
    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({ kind: 'bad-image' });
  });

  it('answers 415 for a PNG labelled as a JPEG', async () => {
    harness = await startHarness();
    const token = await harness.mintToken();
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    const response = await harness.scan(token, png, 'image/jpeg');
    expect(response.status).toBe(415);
  });

  it('answers 413 when Content-Length is over 10 MiB, without reading the body', async () => {
    harness = await startHarness();
    const token = await harness.mintToken();
    const response = await harness.app.request('/api/v1/scan', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'image/jpeg',
        'Content-Length': String(11 * 1024 * 1024),
      },
      body: JPEG,
    });
    expect(response.status).toBe(413);
  });

  it('answers 413 when the stream grows past 10 MiB with no Content-Length', async () => {
    harness = await startHarness();
    const token = await harness.mintToken();
    const chunk = new Uint8Array(1024 * 1024);
    chunk.set([0xff, 0xd8, 0xff]);
    const response = await harness.app.request(
      new Request('http://localhost/api/v1/scan', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/jpeg' },
        body: streamOf(...Array.from({ length: 11 }, () => chunk)),
        duplex: 'half',
      } as RequestInit),
    );
    expect(response.status).toBe(413);
  });

  it('answers 408 unreachable when the body stalls', async () => {
    harness = await startHarness({}, { bodyTimeoutMs: 50 });
    const token = await harness.mintToken();
    const response = await harness.app.request(
      new Request('http://localhost/api/v1/scan', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/jpeg' },
        body: streamThatStalls(JPEG.slice(0, 100)),
        duplex: 'half',
      } as RequestInit),
    );
    expect(response.status).toBe(408);
    expect(await response.json()).toEqual({ kind: 'unreachable' });
  });

  it('spends nothing and never calls Gemini for any of them', async () => {
    harness = await startHarness();
    const token = await harness.mintToken();
    await harness.scan(token, 'hello', 'text/plain');
    await harness.scan(token, new Uint8Array(20), 'image/png');
    expect(harness.stub.requests()).toBe(0);
    expect(deviceCount(harness)).toBe(0);
    expect(globalCount(harness)).toBe(0);
  });
});

describe('POST /api/v1/scan, the limits', () => {
  it('lets 20 scans through and refuses the 21st with scope device and Retry-After', async () => {
    harness = await startHarness();
    const token = await harness.mintToken();
    for (let i = 0; i < 20; i++) expect((await harness.scan(token, JPEG)).status).toBe(200);
    const refused = await harness.scan(token, JPEG);
    expect(refused.status).toBe(429);
    expect(await refused.json()).toEqual({ kind: 'over-limit', scope: 'device' });
    expect(refused.headers.get('Retry-After')).toBe('43200');
    expect(harness.stub.requests()).toBe(20);
  });

  it('refuses a fresh phone with scope global when the day is used up', async () => {
    harness = await startHarness({ SCAN_LIMIT_GLOBAL: '3' });
    for (let i = 0; i < 3; i++) {
      expect((await harness.scan(await harness.mintToken(), JPEG)).status).toBe(200);
    }
    const refused = await harness.scan(await harness.mintToken(), JPEG);
    expect(refused.status).toBe(429);
    expect(await refused.json()).toEqual({ kind: 'over-limit', scope: 'global' });
  });
});

describe('POST /api/v1/scan, when Gemini fails', () => {
  it.each(['503', '429'] as const)('refunds the scan when Gemini answers %s', async (mode) => {
    harness = await startHarness();
    const token = await harness.mintToken();
    harness.stub.setMode(mode);
    const response = await harness.scan(token, JPEG);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ kind: 'unreachable' });
    expect(deviceCount(harness)).toBe(0);
    expect(globalCount(harness)).toBe(0);
  });

  it('keeps the count and answers 422 bad-image when Gemini rejects the photo with 400', async () => {
    harness = await startHarness();
    const token = await harness.mintToken();
    harness.stub.setMode('400');
    const response = await harness.scan(token, JPEG);
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ kind: 'bad-image' });
    expect(deviceCount(harness)).toBe(1);
    expect(globalCount(harness)).toBe(1);
  });

  it('runs a pass out of scans when every photo makes Gemini answer 400', async () => {
    harness = await startHarness({ SCAN_LIMIT_PER_DEVICE: '3' });
    const token = await harness.mintToken();
    harness.stub.setMode('400');
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await harness.scan(token, JPEG)).status);
    expect(statuses).toEqual([422, 422, 422, 429, 429]);
    expect(harness.stub.requests()).toBe(3);
  });

  it('refunds the scan and asks for a key when Gemini rejects the server key', async () => {
    harness = await startHarness();
    const token = await harness.mintToken();
    harness.stub.setMode('401');
    const response = await harness.scan(token, JPEG);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ kind: 'unreachable' });
    expect(deviceCount(harness)).toBe(0);
    expect(globalCount(harness)).toBe(0);
  });

  it('refunds the scan and answers 504 when Gemini hangs past the timeout', async () => {
    harness = await startHarness({}, { geminiTimeoutMs: 100 });
    const token = await harness.mintToken();
    harness.stub.setMode('hang');
    const response = await harness.scan(token, JPEG);
    expect(response.status).toBe(504);
    expect(deviceCount(harness)).toBe(0);
    expect(globalCount(harness)).toBe(0);
  });

  it('refunds the scan when Gemini cannot be reached at all', async () => {
    harness = await startHarness({ GEMINI_BASE_URL: 'http://127.0.0.1:1' });
    const token = await harness.mintToken();
    const response = await harness.scan(token, JPEG);
    expect(response.status).toBe(503);
    expect(globalCount(harness)).toBe(0);
  });

  it('keeps the count and answers 502 model-failed when the output is unreadable', async () => {
    harness = await startHarness();
    const token = await harness.mintToken();
    harness.stub.setMode('junk');
    const response = await harness.scan(token, JPEG);
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ kind: 'model-failed' });
    expect(deviceCount(harness)).toBe(1);
    expect(globalCount(harness)).toBe(1);
  });

  it('never repeats what Gemini said in its error', async () => {
    harness = await startHarness();
    const token = await harness.mintToken();
    harness.stub.setMode('503');
    const response = await harness.scan(token, JPEG);
    expect(await response.text()).not.toContain('secret upstream detail');
  });
});

describe('POST /api/v1/scan, load', () => {
  it('lets one of 10 concurrent scans from a pass through and refuses 9 before Gemini', async () => {
    harness = await startHarness({}, { geminiTimeoutMs: 1_500 });
    const token = await harness.mintToken();
    harness.stub.setMode('hang');
    const first = harness.scan(token, JPEG);
    await vi.waitFor(() => expect(harness.stub.requests()).toBe(1));
    const refused = await Promise.all(Array.from({ length: 9 }, () => harness.scan(token, JPEG)));
    for (const response of refused) {
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ kind: 'unreachable' });
      expect(response.headers.get('Retry-After')).toBe('5');
    }
    expect(harness.stub.requests()).toBe(1);
    expect((await first).status).toBe(504);
  });

  it('allows 4 scans in flight in total and refuses the 5th from another pass', async () => {
    harness = await startHarness({}, { geminiTimeoutMs: 1_500 });
    harness.stub.setMode('hang');
    const running = [];
    for (let i = 0; i < 4; i++) running.push(harness.scan(await harness.mintToken(), JPEG));
    await vi.waitFor(() => expect(harness.stub.requests()).toBe(4));
    const refused = await harness.scan(await harness.mintToken(), JPEG);
    expect(refused.status).toBe(503);
    expect(refused.headers.get('Retry-After')).toBe('5');
    expect(harness.stub.requests()).toBe(4);
    for (const response of await Promise.all(running)) expect(response.status).toBe(504);
  });

  it('frees the slot when a scan ends, so the next scan from the pass goes through', async () => {
    harness = await startHarness();
    const token = await harness.mintToken();
    harness.stub.setMode('400');
    expect((await harness.scan(token, JPEG)).status).toBe(422);
    harness.stub.setMode('ok');
    expect((await harness.scan(token, JPEG)).status).toBe(200);
  });

  it('refuses a used-up pass with 429 without reading the body', async () => {
    harness = await startHarness({ SCAN_LIMIT_PER_DEVICE: '1' }, { bodyTimeoutMs: 60_000 });
    const token = await harness.mintToken();
    expect((await harness.scan(token, JPEG)).status).toBe(200);
    const response = await harness.app.request(
      new Request('http://localhost/api/v1/scan', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/jpeg' },
        body: streamThatStalls(JPEG.slice(0, 100)),
        duplex: 'half',
      } as RequestInit),
    );
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ kind: 'over-limit', scope: 'device' });
  });

  it('refuses any pass with scope global without reading the body when the day is full', async () => {
    harness = await startHarness({ SCAN_LIMIT_GLOBAL: '1' }, { bodyTimeoutMs: 60_000 });
    expect((await harness.scan(await harness.mintToken(), JPEG)).status).toBe(200);
    const response = await harness.app.request(
      new Request('http://localhost/api/v1/scan', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await harness.mintToken()}`,
          'Content-Type': 'image/jpeg',
        },
        body: streamThatStalls(JPEG.slice(0, 100)),
        duplex: 'half',
      } as RequestInit),
    );
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ kind: 'over-limit', scope: 'global' });
  });
});

describe('the request log', () => {
  it('has one line per request with no pass, address, key or receipt text', async () => {
    harness = await startHarness();
    const token = await harness.mintToken();
    await harness.scan(token, JPEG);
    const lines = harness.logs.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(lines.at(-1)).toMatchObject({
      msg: 'request',
      route: '/api/v1/scan',
      status: 200,
      kind: null,
      bytes: JPEG.byteLength,
      promptTokens: 1200,
      outputTokens: 150,
    });
    const everything = harness.logs.join('\n');
    for (const secret of [token, 'test-gemini-key', 'test-secret', 'Chicken Rice']) {
      expect(everything).not.toContain(secret);
    }
  });
});
