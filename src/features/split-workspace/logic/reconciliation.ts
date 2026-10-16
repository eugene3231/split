import type { Amounts, ChargeState, Person, Receipt } from '@shared/types';
import { parseCurrencyToCents, parseNumber } from '@shared/logic/core/money';
import { resolveReceiptCharges } from '@features/split-workspace/logic/split/charges';
import { computeSplit, type ReceiptPricing } from '@features/split-workspace/logic/split/split';
import { splitUnassignedItemsEqually } from '@features/split-workspace/logic/assignmentInteraction';

/**
 * Prices the whole receipt for checking against its printed total. Anything still unclaimed
 * counts as shared, so the result doesn't move as people claim items.
 */
export function computeReceiptTotals(receipt: ReceiptPricing, people: Person[]): Amounts {
  const items = splitUnassignedItemsEqually(receipt.items, people);
  return computeSplit({ ...receipt, items }, people).totals;
}

/** A receipt patch that brings the computed total to the printed one. */
export type ReconciliationFix = { discount: ChargeState } | { roundingInput: string };

export interface Reconciliation {
  /** Printed total minus computed total before tip. Null when no total was entered. */
  cents: number | null;
  /** Null when the totals agree, or when nothing can close the gap. */
  fix: ReconciliationFix | null;
}

/**
 * Checks a receipt against its printed total. A printed total that is higher is made up with
 * rounding; one that is lower is reached with a discount before tax.
 */
export function resolveReconciliation(
  receipt: ReceiptPricing & Pick<Receipt, 'receiptTotalInput'>,
  people: Person[],
): Reconciliation {
  const receiptTotalCents = parseCurrencyToCents(receipt.receiptTotalInput);
  if (receiptTotalCents === null) return { cents: null, fix: null };

  const totals = computeReceiptTotals(receipt, people);
  // The printed total is the bill the tip is added to, so the tip is not part of the check.
  const cents = receiptTotalCents - (totals.totalCents - totals.chargeCents.tip);
  if (cents === 0) return { cents, fix: null };
  if (cents > 0) {
    return {
      cents,
      fix: { roundingInput: ((totals.chargeCents.rounding + cents) / 100).toFixed(2) },
    };
  }

  const discountCents = findReconciliationDiscount({
    subtotalCents: totals.subtotalCents,
    currentDiscountCents: totals.chargeCents.discount,
    serviceCharge: receipt.serviceCharge,
    gst: receipt.gst,
    // Rounding sits outside the charges the discount search recomputes.
    targetTotalCents: receiptTotalCents - totals.chargeCents.rounding,
  });
  if (discountCents === null) return { cents, fix: null };
  return {
    cents,
    fix: {
      discount: {
        ...receipt.discount,
        enabled: true,
        mode: 'amount',
        amountInput: (discountCents / 100).toFixed(2),
      },
    },
  };
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
