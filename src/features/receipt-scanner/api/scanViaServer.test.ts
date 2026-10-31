import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScanErrorKind } from '@shared/api/scan';
import { ScanError } from '@features/receipt-scanner/logic/scanError';
import { useTurnstileStore } from '@features/receipt-scanner/stores/turnstileStore';
import { saveDeviceToken } from './deviceToken';
import { scanViaServer } from './scanViaServer';

const API = 'https://api.test';
const file = new File(['img'], 'r.jpg', { type: 'image/jpeg' });
const receipt = {
  items: [{ description: 'Laksa', amount: 12 }],
  subtotal: 12,
  total: 12,
  detected: {
    gst: { enabled: false, amount: null, percent: null, confidence: null, source: '' },
    serviceCharge: { enabled: false, amount: null, percent: null, confidence: null, source: '' },
  },
  warnings: [],
};

type Reply = Response | Error;
let replies: Reply[];
let fetchMock: ReturnType<typeof vi.fn>;
let unsubscribe: () => void;
let checksShown: number;

function urlsCalled() {
  return fetchMock.mock.calls.map(([url]) => String(url).replace(API, ''));
}

function errorReply(status: number, body?: object) {
  return body ? Response.json(body, { status }) : new Response('nope', { status });
}

beforeEach(() => {
  window.localStorage.clear();
  replies = [];
  checksShown = 0;
  fetchMock = vi.fn(() => {
    const reply = replies.shift();
    if (!reply) throw new Error('unexpected fetch');
    return reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply);
  });
  vi.stubGlobal('fetch', fetchMock);
  unsubscribe = useTurnstileStore.subscribe((state) => {
    if (!state.pending) return;
    checksShown += 1;
    state.pending.resolve('turnstile-ok');
  });
});

afterEach(() => {
  unsubscribe();
  vi.unstubAllGlobals();
});

describe('scanViaServer', () => {
  it('sends the photo bytes with the stored pass and returns the receipt', async () => {
    saveDeviceToken('pass');
    replies = [Response.json({ receipt })];

    await expect(scanViaServer(file, API)).resolves.toEqual(receipt);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API}/api/v1/scan`);
    expect(init.body).toBe(file);
    expect(init.headers).toEqual({ 'Content-Type': 'image/jpeg', Authorization: 'Bearer pass' });
    expect(checksShown).toBe(0);
  });

  it('checks the device and mints before the first scan when it has no pass', async () => {
    replies = [Response.json({ token: 'fresh' }), Response.json({ receipt })];

    await scanViaServer(file, API);

    expect(urlsCalled()).toEqual(['/api/v1/devices', '/api/v1/scan']);
    expect(checksShown).toBe(1);
    expect(window.localStorage.getItem('split.deviceToken')).toBe('fresh');
  });

  it('mints once and retries once when the stored pass is refused', async () => {
    saveDeviceToken('stale');
    replies = [
      errorReply(401, { kind: 'needs-device' }),
      Response.json({ token: 'fresh' }),
      Response.json({ receipt }),
    ];

    await expect(scanViaServer(file, API)).resolves.toEqual(receipt);

    expect(urlsCalled()).toEqual(['/api/v1/scan', '/api/v1/devices', '/api/v1/scan']);
    expect(checksShown).toBe(1);
    expect(window.localStorage.getItem('split.deviceToken')).toBe('fresh');
  });

  it('gives up as unknown when the fresh pass is refused too', async () => {
    saveDeviceToken('stale');
    replies = [
      errorReply(401, { kind: 'needs-device' }),
      Response.json({ token: 'fresh' }),
      errorReply(401, { kind: 'needs-device' }),
    ];

    await expect(scanViaServer(file, API)).rejects.toMatchObject({ kind: 'unknown' });
    expect(urlsCalled()).toHaveLength(3);
  });

  it('does not scan twice when a pass minted for this scan is refused', async () => {
    replies = [Response.json({ token: 'fresh' }), errorReply(401, { kind: 'needs-device' })];

    await expect(scanViaServer(file, API)).rejects.toMatchObject({ kind: 'unknown' });
    expect(urlsCalled()).toEqual(['/api/v1/devices', '/api/v1/scan']);
  });

  it.each<[number, ScanErrorKind]>([
    [403, 'bot-check-failed'],
    [413, 'bad-image'],
    [415, 'bad-image'],
    [422, 'bad-image'],
    [429, 'over-limit'],
    [408, 'unreachable'],
    [500, 'unknown'],
    [502, 'unreachable'],
    [503, 'unreachable'],
    [504, 'unreachable'],
    [522, 'unreachable'],
  ])('maps an unparseable %i reply to %s', async (status, kind) => {
    saveDeviceToken('pass');
    replies = [errorReply(status)];

    await expect(scanViaServer(file, API)).rejects.toMatchObject({ kind });
  });

  it('treats an unparseable 401 as a missing pass and mints', async () => {
    saveDeviceToken('stale');
    replies = [errorReply(401), Response.json({ token: 'fresh' }), Response.json({ receipt })];

    await expect(scanViaServer(file, API)).resolves.toEqual(receipt);
  });

  it('trusts the kind in the body over the status', async () => {
    saveDeviceToken('pass');
    replies = [errorReply(502, { kind: 'model-failed' })];

    await expect(scanViaServer(file, API)).rejects.toMatchObject({ kind: 'model-failed' });
  });

  it('carries the limit scope from the body', async () => {
    saveDeviceToken('pass');
    replies = [errorReply(429, { kind: 'over-limit', scope: 'global' })];

    await expect(scanViaServer(file, API)).rejects.toMatchObject({
      kind: 'over-limit',
      scope: 'global',
    });
  });

  it('maps a fetch rejection to unreachable', async () => {
    saveDeviceToken('pass');
    replies = [new TypeError('Failed to fetch')];

    await expect(scanViaServer(file, API)).rejects.toMatchObject({ kind: 'unreachable' });
  });

  it('maps a 200 that is not a receipt to unknown', async () => {
    saveDeviceToken('pass');
    replies = [Response.json({ receipt: { items: 'nope' } })];

    await expect(scanViaServer(file, API)).rejects.toMatchObject({ kind: 'unknown' });
  });

  it('stops with bot-check-failed when the Turnstile check fails', async () => {
    unsubscribe();
    unsubscribe = useTurnstileStore.subscribe((state) => {
      state.pending?.reject(new ScanError('bot-check-failed'));
    });

    await expect(scanViaServer(file, API)).rejects.toMatchObject({ kind: 'bot-check-failed' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
