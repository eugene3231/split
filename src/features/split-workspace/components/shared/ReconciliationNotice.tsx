import { formatCurrencyFromCents } from '@shared/logic/core/money';

interface Props {
  reconciliationCents: number | null;
  onApplyDiscount?: () => void;
  currency?: string;
}

export function ReconciliationNotice({ reconciliationCents, onApplyDiscount, currency }: Props) {
  if (reconciliationCents === null) return null;

  const isMatch = reconciliationCents === 0;
  const isOver = reconciliationCents > 0;

  if (isMatch) {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-secondary-container/30 bg-secondary-container/20 p-4">
        <div className="flex flex-shrink-0 items-center justify-center rounded-full bg-secondary p-1 text-on-secondary">
          <span
            className="material-symbols-outlined text-sm"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            check
          </span>
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
      {!isOver && onApplyDiscount && (
        <button
          type="button"
          data-testid="apply-discount-reconcile-btn"
          onClick={onApplyDiscount}
          className="w-full rounded-lg bg-on-error-container py-2 text-xs font-bold tracking-wide text-on-primary uppercase transition-opacity hover:opacity-90"
        >
          Resolve Difference (Apply Discount)
        </button>
      )}
    </div>
  );
}
