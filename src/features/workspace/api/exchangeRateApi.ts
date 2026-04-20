/**
 * Fetches live exchange rates from open.er-api.com (no auth required).
 * Returns a map of currency code -> SGD value (1 unit = X SGD),
 * or null if the fetch fails.
 */
export async function fetchExchangeRates(): Promise<Record<string, number> | null> {
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/SGD');
    if (!response.ok) return null;

    const data: unknown = await response.json();
    if (!isRecord(data) || data.result !== 'success' || !isRecord(data.rates)) return null;

    // API returns "1 SGD = X foreign currency", so invert to get "1 foreign = X SGD"
    const ratesMap: Record<string, number> = {};
    for (const [code, rate] of Object.entries(data.rates)) {
      const numRate = typeof rate === 'number' ? rate : Number(rate);
      if (Number.isFinite(numRate) && numRate > 0) {
        ratesMap[code] = 1 / numRate;
      }
    }
    // SGD to SGD is always 1
    ratesMap['SGD'] = 1;

    return ratesMap;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
