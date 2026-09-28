import type { Receipt, SplitResult } from '@shared/types';
import { BASE_CURRENCY } from '@shared/constants';
import { allocateCents } from '@shared/logic/split/allocation';

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

export function convertSplitResult(
  split: SplitResult,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
  override: number | null = null,
): SplitResult {
  if (fromCurrency === toCurrency) return split;

  const convert = (cents: number) => convertCents(cents, fromCurrency, toCurrency, rates, override);

  // Rounding signed category prefixes keeps the converted receipt total exact.
  const subtotalCents = convert(split.subtotalCents);
  const afterDiscountCents = convert(split.subtotalCents - split.discountCents);
  const afterServiceCents = convert(
    split.subtotalCents - split.discountCents + split.serviceChargeCents,
  );
  const grandTotalCents = convert(split.grandTotalCents);
  const discountCents = subtotalCents - afterDiscountCents;
  const serviceChargeCents = afterServiceCents - afterDiscountCents;
  const gstCents = grandTotalCents - afterServiceCents;

  const personIds = Object.keys(split.subtotalByPersonCents);
  const targetByPersonCents = allocateCents(grandTotalCents, personIds, split.totalByPersonCents);
  const totalByPersonCents = Object.fromEntries(personIds.map((id) => [id, 0]));
  const allocateCategory = (
    totalCents: number,
    nativeByPersonCents: Record<string, number>,
    sign: 1 | -1,
  ) => {
    const tiePriority = Object.fromEntries(
      personIds.map((id) => [id, sign * (targetByPersonCents[id] - totalByPersonCents[id])]),
    );
    const amounts = allocateCents(totalCents, personIds, nativeByPersonCents, tiePriority);
    for (const id of personIds) {
      totalByPersonCents[id] += sign * amounts[id];
    }
    return amounts;
  };

  const subtotalByPersonCents = allocateCategory(subtotalCents, split.subtotalByPersonCents, 1);
  const discountByPersonCents = allocateCategory(discountCents, split.discountByPersonCents, -1);
  const serviceByPersonCents = allocateCategory(serviceChargeCents, split.serviceByPersonCents, 1);
  const gstByPersonCents = allocateCategory(gstCents, split.gstByPersonCents, 1);

  const lineItemsByPerson = Object.fromEntries(
    Object.entries(split.lineItemsByPerson).map(([personId, lines]) => {
      const involvedIds = lines
        .map((line, index) => (line.involved ? index.toString().padStart(8, '0') : null))
        .filter((id): id is string => id !== null);
      const weights = Object.fromEntries(
        involvedIds.map((id) => [id, lines[Number(id)].assignedAmountCents]),
      );
      const assigned = allocateCents(subtotalByPersonCents[personId] ?? 0, involvedIds, weights);

      return [
        personId,
        lines.map((line, index) => {
          const assignedAmountCents = line.involved
            ? assigned[index.toString().padStart(8, '0')]
            : 0;
          const grossAmountCents = Math.max(convert(line.grossAmountCents), assignedAmountCents);
          return {
            ...line,
            grossAmountCents,
            discountAmountCents: line.involved
              ? grossAmountCents - assignedAmountCents
              : convert(line.discountAmountCents),
            netAmountCents: assignedAmountCents,
            assignedAmountCents,
          };
        }),
      ];
    }),
  );

  return {
    lineItemsByPerson,
    involvedCountByPerson: { ...split.involvedCountByPerson },
    subtotalByPersonCents,
    discountByPersonCents,
    serviceByPersonCents,
    gstByPersonCents,
    totalByPersonCents,
    subtotalCents,
    discountCents,
    serviceChargeCents,
    gstCents,
    grandTotalCents,
    unassignedItemCount: split.unassignedItemCount,
  };
}
