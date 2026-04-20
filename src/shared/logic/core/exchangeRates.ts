import type { Receipt, SplitResult } from '@shared/types';
import { BASE_CURRENCY } from '@shared/constants';

// Approximate rates: 1 unit of foreign currency = X SGD
// Used as offline fallback when the exchange rate API is unavailable.
export const FALLBACK_RATES_TO_SGD: Record<string, number> = {
  SGD: 1,
  USD: 1.35,
  EUR: 1.48,
  GBP: 1.73,
  THB: 0.038,
  MYR: 0.3,
  JPY: 0.009,
  KRW: 0.00099,
  TWD: 0.042,
  IDR: 0.000083,
  PHP: 0.024,
  AUD: 0.88,
  CNY: 0.19,
  HKD: 0.17,
  VND: 0.000053,
  INR: 0.016,
};

/**
 * Returns the effective exchange rate for a currency to SGD.
 * If an override is provided, it takes precedence over the rates map.
 * Falls back to FALLBACK_RATES_TO_SGD if the currency isn't in the rates map.
 */
export function getEffectiveRate(
  currency: string,
  rates: Record<string, number>,
  override: number | null,
): number {
  if (override !== null && override > 0) return override;
  return rates[currency] ?? FALLBACK_RATES_TO_SGD[currency] ?? 1;
}

/**
 * Converts an integer cent amount from one currency to another.
 * `rates` maps currency code -> SGD value (1 unit of currency = X SGD).
 */
export function convertCents(
  amountCents: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
  override: number | null = null,
): number {
  if (fromCurrency === toCurrency) return amountCents;
  const toSgd = getEffectiveRate(fromCurrency, rates, override);
  const fromSgd = getEffectiveRate(toCurrency, rates, null);
  return Math.round((amountCents * toSgd) / fromSgd);
}

export type ForeignCurrencyRate = {
  currency: string;
  rate: number;
  hasCustomRate: boolean;
};

/**
 * Returns one entry per distinct foreign currency found in `receipts`, using
 * the effective rate for the first receipt that uses each currency.
 * SGD receipts are excluded. Used to display rate info on the consolidated tab.
 */
export function getForeignReceiptRates(
  receipts: Receipt[],
  exchangeRates: Record<string, number>,
): ForeignCurrencyRate[] {
  const seen = new Map<string, ForeignCurrencyRate>();
  for (const receipt of receipts) {
    const currency = receipt.currency ?? BASE_CURRENCY;
    if (currency === BASE_CURRENCY || seen.has(currency)) continue;
    seen.set(currency, {
      currency,
      rate: getEffectiveRate(currency, exchangeRates, receipt.exchangeRateOverride),
      hasCustomRate: receipt.exchangeRateOverride != null,
    });
  }
  return Array.from(seen.values());
}

/**
 * Deep-converts all cent fields in a SplitResult from one currency to another.
 * Line item amounts are also converted for display purposes in consolidated views.
 */
export function convertSplitResult(
  split: SplitResult,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
  override: number | null = null,
): SplitResult {
  if (fromCurrency === toCurrency) return split;

  const convert = (cents: number) => convertCents(cents, fromCurrency, toCurrency, rates, override);
  const convertRecord = (record: Record<string, number>) =>
    Object.fromEntries(Object.entries(record).map(([k, v]) => [k, convert(v)]));

  return {
    lineItemsByPerson: Object.fromEntries(
      Object.entries(split.lineItemsByPerson).map(([personId, lines]) => [
        personId,
        lines.map((line) => ({
          ...line,
          grossAmountCents: convert(line.grossAmountCents),
          discountAmountCents: convert(line.discountAmountCents),
          netAmountCents: convert(line.netAmountCents),
          assignedAmountCents: convert(line.assignedAmountCents),
        })),
      ]),
    ),
    involvedCountByPerson: { ...split.involvedCountByPerson },
    subtotalByPersonCents: convertRecord(split.subtotalByPersonCents),
    discountByPersonCents: convertRecord(split.discountByPersonCents),
    serviceByPersonCents: convertRecord(split.serviceByPersonCents),
    gstByPersonCents: convertRecord(split.gstByPersonCents),
    totalByPersonCents: convertRecord(split.totalByPersonCents),
    subtotalCents: convert(split.subtotalCents),
    discountCents: convert(split.discountCents),
    serviceChargeCents: convert(split.serviceChargeCents),
    gstCents: convert(split.gstCents),
    grandTotalCents: convert(split.grandTotalCents),
    unassignedItemCount: split.unassignedItemCount,
  };
}
