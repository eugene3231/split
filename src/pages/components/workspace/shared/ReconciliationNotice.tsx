import { formatCurrencyFromCents } from '@shared/logic/core/money';

interface Props {
  reconciliationCents: number | null;
  onApplyDiscount?: () => void;
}

export function ReconciliationNotice({ reconciliationCents, onApplyDiscount }: Props) {
  if (reconciliationCents === null) return null;

  const isMatch = reconciliationCents === 0;
  const isOver = reconciliationCents > 0;

  if (isMatch) {
    return (
      <div className="bg-secondary-container/20 p-4 rounded-2xl flex items-center gap-4 border border-secondary-container/30">
        <div className="bg-secondary text-on-secondary rounded-full p-1 flex items-center justify-center flex-shrink-0">
          <span
            className="material-symbols-outlined text-sm"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            check
          </span>
        </div>
        <div>
          <p className="text-xs font-extrabold text-on-secondary-container leading-tight">
            Totals match!
          </p>
          <p className="text-[10px] text-on-secondary-container/80 mt-0.5">
            Verified against computed items.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-error-container/20 p-4 rounded-2xl flex flex-col gap-3 border border-error-container/30">
      <div className="flex items-center gap-4">
        <div className="bg-error text-on-error rounded-full p-1 flex items-center justify-center flex-shrink-0">
          <span
            className="material-symbols-outlined text-sm"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            priority_high
          </span>
        </div>
        <div>
          <p className="text-xs font-extrabold text-on-error-container leading-tight">
            Mismatch found ({formatCurrencyFromCents(Math.abs(reconciliationCents))})
          </p>
          <p className="text-[10px] text-on-error-container/80 mt-0.5">
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
          className="w-full py-2 bg-on-error-container text-on-primary text-[10px] font-bold rounded-lg hover:opacity-90 transition-opacity uppercase tracking-wide"
        >
          Resolve Difference (Apply Discount)
        </button>
      )}
    </div>
  );
}
