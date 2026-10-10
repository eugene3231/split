import type { ChargeDetection, ChargeState } from '@shared/types';
import { parseCurrencyToCents, parseNumber } from '@shared/logic/core/money';

export function resolveChargeCents(charge: ChargeState, percentageBaseCents: number): number {
  if (!charge.enabled) {
    return 0;
  }

  if (charge.mode === 'amount') {
    return parseCurrencyToCents(charge.amountInput) ?? 0;
  }

  const rate = parseNumber(charge.percentInput);
  if (rate === null) {
    return 0;
  }

  return Math.round((percentageBaseCents * rate) / 100);
}

interface ReceiptChargesInput {
  subtotalCents: number;
  discount: ChargeState;
  serviceCharge: ChargeState;
  gst: ChargeState;
}

export function resolveReceiptCharges({
  subtotalCents,
  discount,
  serviceCharge,
  gst,
}: ReceiptChargesInput) {
  const discountCents = Math.min(
    subtotalCents,
    Math.max(0, resolveChargeCents(discount, subtotalCents)),
  );
  const discountedSubtotalCents = subtotalCents - discountCents;
  const serviceChargeCents = resolveChargeCents(serviceCharge, discountedSubtotalCents);
  const gstCents = resolveChargeCents(gst, discountedSubtotalCents + serviceChargeCents);
  return {
    discountCents,
    discountedSubtotalCents,
    serviceChargeCents,
    gstCents,
    grandTotalCents: discountedSubtotalCents + serviceChargeCents + gstCents,
  };
}

export function applyChargeDetection(
  current: ChargeState,
  detection: ChargeDetection,
): ChargeState {
  const next: ChargeState = {
    ...current,
    enabled: detection.enabled,
    detectedConfidence: detection.confidence,
    detectedSource: detection.source === 'none' ? null : detection.source,
  };

  if (detection.amount !== null) {
    next.mode = 'amount';
    next.amountInput = detection.amount.toFixed(2);
  } else if (detection.percent !== null) {
    next.mode = 'percent';
    next.percentInput = detection.percent.toString();
  }

  return next;
}
