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
      <div className="flex items-center gap-4 rounded-2xl bg-accent-green/15 p-4">
        <div className="flex flex-shrink-0 items-center justify-center rounded-full bg-accent-green p-1 text-ink">
          <span
            className="material-symbols-outlined text-sm"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            check
          </span>
        </div>
        <div>
          <p className="text-xs leading-tight font-semibold text-ink">Totals match!</p>
          <p className="mt-0.5 text-[10px] text-ink2">Verified against computed items.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-accent-red/10 p-4">
      <div className="flex items-center gap-4">
        <div className="flex flex-shrink-0 items-center justify-center rounded-full bg-accent-red p-1 text-ink">
          <span
            className="material-symbols-outlined text-sm"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            priority_high
          </span>
        </div>
        <div>
          <p className="text-xs leading-tight font-semibold text-ink">
            Mismatch found ({formatCurrencyFromCents(Math.abs(reconciliationCents))})
          </p>
          <p className="mt-0.5 text-[10px] text-ink2">
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
          className="w-full rounded-full bg-ink py-2 text-[10px] font-semibold tracking-wide text-white uppercase transition-opacity hover:opacity-90"
        >
          Resolve Difference (Apply Discount)
        </button>
      )}
    </div>
  );
}
