import { LOCAL_STORAGE_EXCHANGE_RATES_KEY } from '@features/split-workspace/constants';

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function saveExchangeRates(rates: Record<string, number>): void {
  const storage = getBrowserStorage();
  if (!storage) return;
  try {
    storage.setItem(
      LOCAL_STORAGE_EXCHANGE_RATES_KEY,
      JSON.stringify({ rates, savedAt: Date.now() }),
    );
  } catch {
    // Ignore storage write failures.
  }
}

export function loadExchangeRates(): Record<string, number> | null {
  const storage = getBrowserStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(LOCAL_STORAGE_EXCHANGE_RATES_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || !('rates' in parsed)) return null;
    const { rates } = parsed as { rates: unknown };
    if (typeof rates !== 'object' || rates === null) return null;
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(rates)) {
      if (typeof v === 'number' && Number.isFinite(v)) result[k] = v;
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}
