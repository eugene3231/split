import { CHARGE_KINDS } from '@shared/types';
import type { Amounts, ChargeKind, SplitLine, SplitResult } from '@shared/types';
import { allocate, allocateCents } from '@features/split-workspace/logic/split/allocation';
import {
  centsByPerson,
  mapCharges,
  signedCharge,
} from '@features/split-workspace/logic/split/amounts';

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

/**
 * Converts a split so that it still adds up: every charge sums to its converted total across
 * people, and each person's amounts sum to their own total.
 */
export function convertSplitResult(
  split: SplitResult,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
  override: number | null = null,
): SplitResult {
  if (fromCurrency === toCurrency) return split;

  const totals = convertTotals(split.totals, (cents) =>
    convertCents(cents, fromCurrency, toCurrency, rates, override),
  );

  const personIds = Object.keys(split.byPerson);
  const targetByPerson = allocateCents(totals.totalCents, personIds, centsByPerson(split, 'total'));
  const totalByPerson = Object.fromEntries(personIds.map((id) => [id, 0]));
  // Shares one converted amount between people, and leans a tied cent toward whoever is
  // furthest from their target total so far.
  const share = (totalCents: number, amount: 'subtotal' | ChargeKind) => {
    const sign = amount === 'subtotal' ? 1 : signedCharge(amount, 1);
    const tiePriority = Object.fromEntries(
      personIds.map((id) => [id, sign * (targetByPerson[id] - totalByPerson[id])]),
    );
    const cents = allocateCents(totalCents, personIds, centsByPerson(split, amount), tiePriority);
    for (const id of personIds) {
      totalByPerson[id] += sign * cents[id];
    }
    return cents;
  };

  const subtotalByPerson = share(totals.subtotalCents, 'subtotal');
  const discountByPerson = share(totals.chargeCents.discount, 'discount');
  repairDiscountCoverage({
    personIds,
    subtotalByPerson,
    discountByPerson,
    totalByPerson,
    targetByPerson,
  });
  const serviceByPerson = share(totals.chargeCents.service, 'service');
  const gstByPerson = share(totals.chargeCents.gst, 'gst');
  const roundingByPerson = share(totals.chargeCents.rounding, 'rounding');

  return {
    totals,
    byPerson: Object.fromEntries(
      personIds.map((id) => [
        id,
        {
          subtotalCents: subtotalByPerson[id],
          chargeCents: {
            discount: discountByPerson[id],
            service: serviceByPerson[id],
            gst: gstByPerson[id],
            rounding: roundingByPerson[id],
          },
          totalCents: totalByPerson[id],
          lines: convertLines(split.byPerson[id].lines, subtotalByPerson[id]),
        },
      ]),
    ),
  };
}

/**
 * Converts the running total after the subtotal and after each charge, and takes each charge
 * as the step between two of them, so the converted amounts still add up to the converted total.
 */
function convertTotals(native: Amounts, convert: (cents: number) => number): Amounts {
  const after = (applied: readonly ChargeKind[]) =>
    convert(
      applied.reduce(
        (total, kind) => total + signedCharge(kind, native.chargeCents[kind]),
        native.subtotalCents,
      ),
    );
  return {
    subtotalCents: after([]),
    chargeCents: mapCharges((kind) => {
      const applied = CHARGE_KINDS.slice(0, CHARGE_KINDS.indexOf(kind) + 1);
      return signedCharge(kind, after(applied) - after(applied.slice(0, -1)));
    }),
    totalCents: after(CHARGE_KINDS),
  };
}

/** Shares a person's converted subtotal between the items they had. */
function convertLines(lines: SplitLine[], subtotalCents: number): SplitLine[] {
  const cents = allocate(
    subtotalCents,
    lines.flatMap((line) => line.amountCents ?? []),
  );
  let next = 0;
  return lines.map((line) =>
    line.amountCents === null ? line : { ...line, amountCents: cents[next++] },
  );
}

interface DiscountCoverageInput {
  personIds: string[];
  subtotalByPerson: Record<string, number>;
  discountByPerson: Record<string, number>;
  totalByPerson: Record<string, number>;
  targetByPerson: Record<string, number>;
}

/** Moves subtotal cents to anyone whose converted discount came out larger than their subtotal. */
function repairDiscountCoverage({
  personIds,
  subtotalByPerson,
  discountByPerson,
  totalByPerson,
  targetByPerson,
}: DiscountCoverageInput) {
  for (const recipient of [...personIds].sort()) {
    let shortage = discountByPerson[recipient] - subtotalByPerson[recipient];
    if (shortage <= 0) continue;
    const donors = personIds
      .filter((id) => subtotalByPerson[id] > discountByPerson[id])
      .sort(
        (a, b) =>
          totalByPerson[b] - targetByPerson[b] - (totalByPerson[a] - targetByPerson[a]) ||
          a.localeCompare(b),
      );
    for (const donor of donors) {
      const transfer = Math.min(shortage, subtotalByPerson[donor] - discountByPerson[donor]);
      subtotalByPerson[donor] -= transfer;
      subtotalByPerson[recipient] += transfer;
      totalByPerson[donor] -= transfer;
      totalByPerson[recipient] += transfer;
      shortage -= transfer;
      if (shortage === 0) break;
    }
  }
}
