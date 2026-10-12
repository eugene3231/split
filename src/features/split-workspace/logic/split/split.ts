import type { Person, PersonSplit, Receipt, ReceiptSplit, SplitResult } from '@shared/types';
import { parseCurrencyToCents } from '@shared/logic/core/money';
import { resolveReceiptCharges } from '@features/split-workspace/logic/split/charges';
import { resolveDiscountedAmountCents } from '@features/split-workspace/logic/split/pricing';
import { convertSplitResult } from '@features/split-workspace/logic/exchangeRates';
import { allocateCents } from '@features/split-workspace/logic/split/allocation';
import { sumAmounts } from '@features/split-workspace/logic/split/amounts';
import { BASE_CURRENCY } from '@shared/constants';
import { allocateItemShares } from '@features/split-workspace/logic/itemShare';
import type { NonEmptyArray } from '@features/split-workspace/logic/nonEmpty';

/** What it takes to price a receipt. */
export type ReceiptPricing = Pick<
  Receipt,
  'items' | 'discount' | 'serviceCharge' | 'gst' | 'roundingInput'
>;

interface ResolvedItem {
  itemId: string;
  name: string;
  /** Only the people on the item have an entry. */
  netByPerson: Record<string, number>;
}

/**
 * Splits a receipt between the people on its items. An item nobody has is left out, and the
 * part of an item that is still unassigned is charged to nobody.
 */
export function computeSplit(receipt: ReceiptPricing, people: Person[]): SplitResult {
  const personIds = people.map((person) => person.id);
  const validPeopleSet = new Set(personIds);

  const resolvedItems: ResolvedItem[] = [];

  for (const item of receipt.items) {
    const netAmountCents = resolveDiscountedAmountCents(item);
    if (netAmountCents === null || netAmountCents === 0) continue;

    const shares = Object.fromEntries(
      Object.entries(item.assignment.shares).filter(([id]) => validPeopleSet.has(id)),
    );
    if (Object.keys(shares).length === 0) continue;

    resolvedItems.push({
      itemId: item.id,
      name: item.name.trim() || 'Untitled item',
      netByPerson: allocateItemShares(netAmountCents, { ...item.assignment, shares }),
    });
  }

  const linesByPerson = Object.fromEntries(
    personIds.map((personId) => [
      personId,
      resolvedItems.map((resolved) => ({
        itemId: resolved.itemId,
        name: resolved.name,
        amountCents: Object.hasOwn(resolved.netByPerson, personId)
          ? resolved.netByPerson[personId]
          : null,
      })),
    ]),
  );
  const subtotalByPerson = Object.fromEntries(
    personIds.map((personId) => [
      personId,
      linesByPerson[personId].reduce((sum, line) => sum + (line.amountCents ?? 0), 0),
    ]),
  );

  const subtotalCents = sumMapValues(subtotalByPerson);
  const { discountCents, serviceChargeCents, gstCents } = resolveReceiptCharges({
    subtotalCents,
    discount: receipt.discount,
    serviceCharge: receipt.serviceCharge,
    gst: receipt.gst,
  });
  // Each charge is shared in proportion to what it is charged on, and evenly when that is nothing.
  const discountByPerson = allocateCents(discountCents, personIds, subtotalByPerson);

  const discountedByPerson = Object.fromEntries(
    personIds.map((personId) => [
      personId,
      Math.max(0, subtotalByPerson[personId] - discountByPerson[personId]),
    ]),
  );
  const serviceByPerson = allocateCents(serviceChargeCents, personIds, discountedByPerson);

  const gstBaseByPerson = Object.fromEntries(
    personIds.map((personId) => [
      personId,
      discountedByPerson[personId] + serviceByPerson[personId],
    ]),
  );
  const gstByPerson = allocateCents(gstCents, personIds, gstBaseByPerson);

  // Rounding comes after tax and is split evenly between everyone with something on the receipt.
  const roundedPersonIds = personIds.filter((personId) =>
    linesByPerson[personId].some((line) => line.amountCents !== null),
  );
  const roundingByPerson = allocateCents(
    parseCurrencyToCents(receipt.roundingInput) ?? 0,
    roundedPersonIds,
    Object.fromEntries(roundedPersonIds.map((personId) => [personId, 1])),
  );

  const byPerson = Object.fromEntries(
    personIds.map((personId): [string, PersonSplit] => {
      const chargeCents = {
        discount: discountByPerson[personId],
        service: serviceByPerson[personId],
        gst: gstByPerson[personId],
        rounding: roundingByPerson[personId] ?? 0,
      };
      return [
        personId,
        {
          subtotalCents: subtotalByPerson[personId],
          chargeCents,
          totalCents:
            discountedByPerson[personId] +
            chargeCents.service +
            chargeCents.gst +
            chargeCents.rounding,
          lines: linesByPerson[personId],
        },
      ];
    }),
  );

  return { totals: sumAmounts(Object.values(byPerson)), byPerson };
}

/** Every receipt added up in one currency, each converted at its own rate first. */
export function consolidateSplits(
  receiptSplits: NonEmptyArray<ReceiptSplit>,
  exchangeRates: Record<string, number>,
  currency: string = BASE_CURRENCY,
): SplitResult {
  return receiptSplits
    .map(({ receipt, split }) =>
      convertSplitResult(
        split,
        receipt.currency,
        currency,
        exchangeRates,
        receipt.exchangeRateOverride,
      ),
    )
    .reduce(addSplits);
}

/** Both splits cover the same people. */
function addSplits(a: SplitResult, b: SplitResult): SplitResult {
  return {
    totals: sumAmounts([a.totals, b.totals]),
    byPerson: Object.fromEntries(
      Object.entries(a.byPerson).map(([personId, person]) => {
        const other = b.byPerson[personId];
        return [
          personId,
          { ...sumAmounts([person, other]), lines: [...person.lines, ...other.lines] },
        ];
      }),
    ),
  };
}

function sumMapValues(values: Record<string, number>): number {
  return Object.values(values).reduce((sum, value) => sum + value, 0);
}
