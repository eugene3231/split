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
import type { CurrencyCode } from '@shared/constants';

interface Props {
  totals: Amounts;
  charges: ReceiptCharges;
  currency: CurrencyCode;
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
    <div className="mt-4 mb-5 space-y-2.5 border-t border-surface-container-high pt-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-on-surface-variant">Subtotal</span>
        <span className="font-medium text-on-surface tabular-nums">
          {formatCurrencyFromCents(totals.subtotalCents, currency)}
        </span>
      </div>
      {shownCharges.map((kind) => (
        <div key={kind} className="flex items-center justify-between text-sm">
          <span
            className={cn(
              'text-on-surface-variant',
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
              'font-medium tabular-nums',
              CHARGE_SIGN[kind] === 'minus' ? 'text-secondary' : 'text-on-surface',
            )}
          >
            {CHARGE_SIGN[kind] === 'minus' ? '−' : '+'}
            {formatCurrencyFromCents(totals.chargeCents[kind], currency)}
          </span>
        </div>
      ))}
      <div className="flex items-baseline justify-between border-t border-dashed border-surface-container-highest pt-3">
        <span className="text-base font-semibold text-on-surface">Total</span>
        <span className="font-headline text-2xl font-bold text-on-surface tabular-nums">
          {formatCurrencyFromCents(totals.totalCents, currency)}
        </span>
      </div>
    </div>
  );
}
