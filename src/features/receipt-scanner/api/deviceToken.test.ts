import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScanError } from '@features/receipt-scanner/logic/scanError';
import { loadDeviceToken, mintDeviceToken, saveDeviceToken } from './deviceToken';

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('mintDeviceToken', () => {
  it('posts the Turnstile token and keeps the pass in localStorage', async () => {
    const fetchMock = stubFetch(Response.json({ token: 'pass-1' }));

    await expect(mintDeviceToken('https://api.test', 'turnstile-ok')).resolves.toBe('pass-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/api/v1/devices',
      expect.objectContaining({ body: JSON.stringify({ turnstileToken: 'turnstile-ok' }) }),
    );
    expect(window.localStorage.getItem('split.deviceToken')).toBe('pass-1');
    expect(loadDeviceToken()).toBe('pass-1');
  });

  it('reads the kind and scope from an error body', async () => {
    stubFetch(Response.json({ kind: 'over-limit', scope: 'mint' }, { status: 429 }));

    await expect(mintDeviceToken('https://api.test', 't')).rejects.toMatchObject({
      kind: 'over-limit',
      scope: 'mint',
    });
  });

  it('maps a failed fetch to unreachable', async () => {
    stubFetch(new TypeError('Failed to fetch'));

    await expect(mintDeviceToken('https://api.test', 't')).rejects.toEqual(
      new ScanError('unreachable'),
    );
  });

  it('forgets nothing when storage holds no pass', () => {
    saveDeviceToken('abc');
    expect(loadDeviceToken()).toBe('abc');
    window.localStorage.clear();
    expect(loadDeviceToken()).toBeNull();
  });
});
