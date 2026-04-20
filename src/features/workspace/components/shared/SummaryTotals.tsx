import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { buildChargeLabel } from '@shared/logic/computation/chargeLabels';
import type { ChargeState, SplitResult } from '@shared/types';

interface Props {
  split: SplitResult;
  discount: ChargeState;
  serviceCharge: ChargeState;
  gst: ChargeState;
  currency?: string;
}

export function SummaryTotals({ split, discount, serviceCharge, gst, currency }: Props) {
  const activeChargesCents = split.serviceChargeCents + split.gstCents - split.discountCents;

  return (
    <div className="mb-8 space-y-4 border-t border-surface-container-high pt-6">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-on-surface-variant">Subtotal</span>
        <span className="font-bold text-on-surface">
          {formatCurrencyFromCents(split.subtotalCents, currency)}
        </span>
      </div>
      {split.discountCents > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-on-surface-variant">
            {buildChargeLabel('Discount', discount)}
          </span>
          <span className="font-bold text-secondary">
            −{formatCurrencyFromCents(split.discountCents, currency)}
          </span>
        </div>
      )}
      {(split.serviceChargeCents > 0 || serviceCharge.enabled) && (
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-on-surface-variant">
            {buildChargeLabel('Service Charge', serviceCharge)}
          </span>
          <span className="font-bold text-primary">
            +{formatCurrencyFromCents(split.serviceChargeCents, currency)}
          </span>
        </div>
      )}
      {(split.gstCents > 0 || gst.enabled) && (
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-on-surface-variant">
            {buildChargeLabel('GST / Tax', gst)}
          </span>
          <span className="font-bold text-primary">
            +{formatCurrencyFromCents(split.gstCents, currency)}
          </span>
        </div>
      )}
      {activeChargesCents !== 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-on-surface-variant">Active Charges</span>
          <span className="font-bold text-primary">
            {activeChargesCents > 0 ? '+' : ''}
            {formatCurrencyFromCents(activeChargesCents, currency)}
          </span>
        </div>
      )}
      <div className="flex items-center justify-between pt-2">
        <span className="text-base font-extrabold text-primary">Computed Total</span>
        <span className="font-headline text-2xl font-extrabold text-primary">
          {formatCurrencyFromCents(split.grandTotalCents, currency)}
        </span>
      </div>
    </div>
  );
}
