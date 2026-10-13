import { formatPercentInput, parseNumber } from '@shared/logic/core/money';
import type { ChargeKind, ChargeState, Receipt } from '@shared/types';

/** The charges a receipt lets you set. Rounding is the fourth charge and has no setting. */
export type ReceiptCharges = Pick<Receipt, 'discount' | 'serviceCharge' | 'gst'>;

const CHARGE_NAME: Record<ChargeKind, string> = {
  discount: 'Discount',
  service: 'Service Charge',
  gst: 'GST / Tax',
  rounding: 'Rounding',
};

export function chargeSetting(kind: ChargeKind, charges: ReceiptCharges): ChargeState | null {
  if (kind === 'discount') return charges.discount;
  if (kind === 'service') return charges.serviceCharge;
  if (kind === 'gst') return charges.gst;
  return null;
}

/** "Service Charge (10%)", "Discount (off)", or the bare name for a fixed amount. */
export function resolveChargeLabel(kind: ChargeKind, charges: ReceiptCharges): string {
  const label = CHARGE_NAME[kind];
  const charge = chargeSetting(kind, charges);
  if (!charge) return label;
  if (!charge.enabled) return `${label} (off)`;
  if (charge.mode === 'percent') {
    if (parseNumber(charge.percentInput) !== null) {
      return `${label} (${formatPercentInput(charge.percentInput)}%)`;
    }
    return `${label} (%)`;
  }
  return label;
}
