import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { buildChargeLabel } from '@features/split-workspace/logic/chargeLabels';
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
    <div className="mb-6 space-y-3 border-t border-cream-dim pt-5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-ink2">Subtotal</span>
        <span className="font-semibold text-ink">
          {formatCurrencyFromCents(split.subtotalCents, currency)}
        </span>
      </div>
      {split.discountCents > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-ink2">{buildChargeLabel('Discount', discount)}</span>
          <span className="font-semibold text-accent-green">
            −{formatCurrencyFromCents(split.discountCents, currency)}
          </span>
        </div>
      )}
      {(split.serviceChargeCents > 0 || serviceCharge.enabled) && (
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-ink2">
            {buildChargeLabel('Service Charge', serviceCharge)}
          </span>
          <span className="font-semibold text-ink">
            +{formatCurrencyFromCents(split.serviceChargeCents, currency)}
          </span>
        </div>
      )}
      {(split.gstCents > 0 || gst.enabled) && (
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-ink2">{buildChargeLabel('GST / Tax', gst)}</span>
          <span className="font-semibold text-ink">
            +{formatCurrencyFromCents(split.gstCents, currency)}
          </span>
        </div>
      )}
      {activeChargesCents !== 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-ink2">Active Charges</span>
          <span className="font-semibold text-ink">
            {activeChargesCents > 0 ? '+' : ''}
            {formatCurrencyFromCents(activeChargesCents, currency)}
          </span>
        </div>
      )}
      <div className="flex items-center justify-between pt-2">
        <span className="text-base font-semibold text-ink">Computed Total</span>
        <span className="font-display text-2xl font-semibold text-ink">
          {formatCurrencyFromCents(split.grandTotalCents, currency)}
        </span>
      </div>
    </div>
  );
}
