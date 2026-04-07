import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchExchangeRates } from '@shared/api/exchangeRateApi';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchExchangeRates', () => {
  it('returns a rates map when the API responds successfully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          result: 'success',
          // Rates from the API are expressed as "1 SGD = X foreign"
          // The function inverts them to "1 foreign = X SGD"
          rates: {
            SGD: 1,
            USD: 0.74, // 1 SGD = 0.74 USD → 1 USD = 1/0.74 ≈ 1.35 SGD
            THB: 26.3, // 1 SGD = 26.3 THB → 1 THB = 1/26.3 ≈ 0.038 SGD
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const rates = await fetchExchangeRates();

    expect(rates).not.toBeNull();
    expect(rates!['SGD']).toBe(1);
    expect(rates!['USD']).toBeCloseTo(1 / 0.74, 5);
    expect(rates!['THB']).toBeCloseTo(1 / 26.3, 5);
  });

  it('returns null when the API returns a non-ok status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 500 }));

    const rates = await fetchExchangeRates();
    expect(rates).toBeNull();
  });

  it('returns null when the API response is not a success result', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ result: 'error', 'error-type': 'invalid-key' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const rates = await fetchExchangeRates();
    expect(rates).toBeNull();
  });

  it('returns null when fetch throws (network error)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const rates = await fetchExchangeRates();
    expect(rates).toBeNull();
  });

  it('returns null for malformed JSON response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{broken', { status: 200 }));

    const rates = await fetchExchangeRates();
    expect(rates).toBeNull();
  });

  it('always includes SGD: 1 regardless of what the API returns', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          result: 'success',
          rates: { USD: 0.74 }, // no SGD entry
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const rates = await fetchExchangeRates();
    expect(rates!['SGD']).toBe(1);
  });

  it('skips rate entries that are zero or non-finite', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          result: 'success',
          rates: {
            SGD: 1,
            USD: 0, // zero — invalid, would cause division by zero
            EUR: Infinity, // non-finite
            GBP: 0.58, // valid
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const rates = await fetchExchangeRates();
    expect(rates).not.toBeNull();
    expect(rates!['USD']).toBeUndefined();
    expect(rates!['EUR']).toBeUndefined();
    expect(rates!['GBP']).toBeCloseTo(1 / 0.58, 5);
  });
});
