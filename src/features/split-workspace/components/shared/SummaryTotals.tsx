import { formatCurrencyFromCents } from '@shared/logic/core/money';
import {
  chargeSetting,
  resolveChargeLabel,
  type ReceiptCharges,
} from '@features/split-workspace/logic/chargeLabels';
import { CHARGE_SIGN } from '@features/split-workspace/logic/split/amounts';
import { cn } from '@shared/utils/cn';
import { CHARGE_KINDS } from '@shared/types';
import type { Amounts } from '@shared/types';

interface Props {
  totals: Amounts;
  charges: ReceiptCharges;
  currency: string;
  onRemoveRounding: () => void;
}

export function SummaryTotals({ totals, charges, currency, onRemoveRounding }: Props) {
  // A discount shows once it takes something off. Service charge and tax also show while they
  // are switched on at zero, and rounding shows whichever way it goes.
  const shownCharges = CHARGE_KINDS.filter((kind) => {
    const cents = totals.chargeCents[kind];
    if (kind === 'rounding') return cents !== 0;
    if (kind === 'discount') return cents > 0;
    return cents > 0 || chargeSetting(kind, charges)?.enabled;
  });

  return (
    <div className="mb-8 space-y-4 border-t border-surface-container-high pt-6">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-on-surface-variant">Subtotal</span>
        <span className="font-bold text-on-surface">
          {formatCurrencyFromCents(totals.subtotalCents, currency)}
        </span>
      </div>
      {shownCharges.map((kind) => (
        <div key={kind} className="flex items-center justify-between text-sm">
          <span
            className={cn(
              'font-medium text-on-surface-variant',
              kind === 'rounding' && 'flex items-center gap-1',
            )}
          >
            {kind === 'rounding' && (
              <button
                type="button"
                data-testid="remove-rounding-btn"
                aria-label="Remove rounding"
                onClick={onRemoveRounding}
                className="-ml-0.5 flex items-center rounded-full p-0.5 transition-colors hover:text-error"
              >
                <span aria-hidden="true" className="material-symbols-outlined !text-base">
                  close
                </span>
              </button>
            )}
            {resolveChargeLabel(kind, charges)}
          </span>
          <span
            className={cn(
              'font-bold',
              CHARGE_SIGN[kind] === 'minus' ? 'text-secondary' : 'text-primary',
            )}
          >
            {CHARGE_SIGN[kind] === 'minus' ? '−' : '+'}
            {formatCurrencyFromCents(totals.chargeCents[kind], currency)}
          </span>
        </div>
      ))}
      <div className="flex items-center justify-between pt-2">
        <span className="text-base font-extrabold text-primary">Computed Total</span>
        <span className="font-headline text-2xl font-extrabold text-primary">
          {formatCurrencyFromCents(totals.totalCents, currency)}
        </span>
      </div>
    </div>
  );
}
