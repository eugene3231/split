import type { ChargeState } from '@shared/types';
import { parseNumber } from '@shared/logic/core/money';
import { resolveReceiptCharges } from '@features/split-workspace/logic/split/charges';

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
