import type { Amounts, ChargeKind, SplitResult } from '@shared/types';

export const CHARGE_SIGN: Record<ChargeKind, 'minus' | 'plus'> = {
  discount: 'minus',
  service: 'plus',
  gst: 'plus',
  rounding: 'plus',
  tip: 'plus',
};

/** A value for every charge. Adding a charge kind fails to compile here until it has one. */
export function mapCharges<T>(valueOf: (kind: ChargeKind) => T): Record<ChargeKind, T> {
  return {
    discount: valueOf('discount'),
    service: valueOf('service'),
    gst: valueOf('gst'),
    rounding: valueOf('rounding'),
    tip: valueOf('tip'),
  };
}

/** A charge as it moves a total: a discount counts against it. */
export function signedCharge(kind: ChargeKind, cents: number): number {
  return CHARGE_SIGN[kind] === 'minus' ? -cents : cents;
}

export function sumAmounts(amounts: Amounts[]): Amounts {
  const sum = (pick: (entry: Amounts) => number) =>
    amounts.reduce((total, entry) => total + pick(entry), 0);
  return {
    subtotalCents: sum((entry) => entry.subtotalCents),
    chargeCents: mapCharges((kind) => sum((entry) => entry.chargeCents[kind])),
    totalCents: sum((entry) => entry.totalCents),
  };
}

/** One figure for each person: their subtotal, their total, or one of their charges. */
export function centsByPerson(
  split: SplitResult,
  amount: 'subtotal' | 'total' | ChargeKind,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(split.byPerson).map(([personId, person]) => [
      personId,
      amount === 'subtotal'
        ? person.subtotalCents
        : amount === 'total'
          ? person.totalCents
          : person.chargeCents[amount],
    ]),
  );
}
