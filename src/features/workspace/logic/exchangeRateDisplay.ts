import { FALLBACK_RATES_TO_SGD } from '@shared/logic/core/exchangeRates';

export function computeEffectiveRate(
  currency: string,
  exchangeRates: Record<string, number>,
  exchangeRateOverride: number | null,
): number {
  if (exchangeRateOverride !== null && exchangeRateOverride > 0) return exchangeRateOverride;
  return exchangeRates[currency] ?? FALLBACK_RATES_TO_SGD[currency] ?? 1;
}

export function computeReverseRate(effectiveRate: number): number {
  return effectiveRate > 0 ? 1 / effectiveRate : 0;
}

export function parseRateInput(
  inputValue: string,
  editingField: 'forward' | 'reverse' | null,
): number | null {
  const parsed = parseFloat(inputValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return editingField === 'reverse' ? 1 / parsed : parsed;
}
