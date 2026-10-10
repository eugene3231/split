import type { ChargeState, Person, Receipt, SplitResult } from '@shared/types';
import { parseNumber } from '@shared/logic/core/money';
import { resolveReceiptCharges } from '@features/split-workspace/logic/split/charges';
import { computeSplit } from '@features/split-workspace/logic/split/split';
import { splitUnassignedItemsEqually } from '@features/split-workspace/logic/assignmentInteraction';

type ReceiptPricing = Pick<
  Receipt,
  'items' | 'discount' | 'serviceCharge' | 'gst' | 'roundingInput'
>;

/**
 * Prices the whole receipt for checking against its printed total. Anything still unclaimed
 * counts as shared, so the result doesn't move as people claim items.
 */
export function computeReceiptTotals(receipt: ReceiptPricing, people: Person[]): SplitResult {
  return computeSplit({
    people,
    items: splitUnassignedItemsEqually(receipt.items, people),
    discount: receipt.discount,
    serviceCharge: receipt.serviceCharge,
    gst: receipt.gst,
    roundingInput: receipt.roundingInput,
  });
}

interface ReconciliationDiscountInput {
  subtotalCents: number;
  currentDiscountCents: number;
  serviceCharge: ChargeState;
  gst: ChargeState;
  targetTotalCents: number;
}

export function findReconciliationDiscount({
  subtotalCents,
  currentDiscountCents,
  serviceCharge,
  gst,
  targetTotalCents,
}: ReconciliationDiscountInput): number | null {
  if (!Number.isSafeInteger(targetTotalCents) || targetTotalCents < 0) return null;
  if (
    [serviceCharge, gst].some(
      (charge) =>
        charge.enabled && charge.mode === 'percent' && (parseNumber(charge.percentInput) ?? 0) < 0,
    )
  )
    return null;

  const totalAt = (discountCents: number) =>
    resolveReceiptCharges({
      subtotalCents,
      discount: {
        enabled: true,
        mode: 'amount',
        amountInput: (discountCents / 100).toFixed(2),
        percentInput: '',
        detectedConfidence: null,
        detectedSource: null,
      },
      serviceCharge,
      gst,
    }).grandTotalCents;
  const currentTotalCents = totalAt(currentDiscountCents);
  if (currentTotalCents <= targetTotalCents) return null;

  let low = currentDiscountCents;
  let high = subtotalCents;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (totalAt(middle) > targetTotalCents) low = middle + 1;
    else high = middle;
  }
  const previous = Math.max(currentDiscountCents, low - 1);
  const discountCents =
    Math.abs(totalAt(previous) - targetTotalCents) <= Math.abs(totalAt(low) - targetTotalCents)
      ? previous
      : low;
  return discountCents === currentDiscountCents ? null : discountCents;
}
