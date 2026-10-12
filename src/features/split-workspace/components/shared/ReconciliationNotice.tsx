import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { CheckIcon } from './CheckIcon';
import type {
  Reconciliation,
  ReconciliationFix,
} from '@features/split-workspace/logic/reconciliation';
import type { CurrencyCode } from '@shared/constants';

interface Props {
  reconciliation: Reconciliation;
  currency: CurrencyCode;
  onApplyFix: (fix: ReconciliationFix) => void;
}

export function ReconciliationNotice({ reconciliation, currency, onApplyFix }: Props) {
  const { cents: reconciliationCents, fix } = reconciliation;
  if (reconciliationCents === null) return null;

  const isMatch = reconciliationCents === 0;
  const isOver = reconciliationCents > 0;

  if (isMatch) {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-secondary-container/30 bg-secondary-container/20 p-4">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-on-secondary">
          <CheckIcon className="h-4.5 w-4.5" />
        </div>
        <div>
          <p className="text-xs leading-tight font-extrabold text-on-secondary-container">
            Totals match!
          </p>
          <p className="mt-0.5 text-xs text-on-secondary-container/80">
            Verified against computed items.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-error-container/30 bg-error-container/20 p-4">
      <div className="flex items-center gap-4">
        <div className="flex flex-shrink-0 items-center justify-center rounded-full bg-error p-1 text-on-error">
          <span
            className="material-symbols-outlined text-sm"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            priority_high
          </span>
        </div>
        <div>
          <p className="text-xs leading-tight font-extrabold text-on-error-container">
            Mismatch found ({formatCurrencyFromCents(Math.abs(reconciliationCents), currency)})
          </p>
          <p className="mt-0.5 text-xs text-on-error-container/80">
            {isOver
              ? 'Computed total is lower than receipt.'
              : 'Computed total is higher than receipt.'}
          </p>
        </div>
      </div>
      {/* The discount button stays up even when no discount can close the gap (#193). */}
      <button
        type="button"
        data-testid={isOver ? 'add-rounding-reconcile-btn' : 'apply-discount-reconcile-btn'}
        onClick={() => {
          if (fix) onApplyFix(fix);
        }}
        className="w-full rounded-lg bg-on-error-container py-2 text-xs font-bold tracking-wide text-on-primary uppercase transition-opacity hover:opacity-90"
      >
        {isOver
          ? `Add ${formatCurrencyFromCents(reconciliationCents, currency)} as rounding`
          : 'Resolve Difference (Apply Discount)'}
      </button>
    </div>
  );
}
