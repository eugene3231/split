import type { AssignmentReviewRow } from '@features/split-workspace/logic/assignmentInteraction';
import { cn } from '@shared/utils/cn';

type ReviewPhaseProps = {
  rows: AssignmentReviewRow[];
  itemCount: number;
  onEditItem: (index: number) => void;
};

export function ReviewPhase({ rows, itemCount, onEditItem }: ReviewPhaseProps) {
  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-headline text-2xl font-bold text-on-surface">Review Assignments</h2>
        <span className="text-sm text-on-surface-variant">
          {itemCount} item{itemCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => {
          return (
            <article
              key={row.itemId}
              className={cn(
                'flex items-center justify-between gap-3 rounded-xl border p-4 transition-all',
                row.isAssigned
                  ? 'border-surface-container-highest bg-surface-container-lowest hover:border-outline-variant/30'
                  : 'border-error/50 bg-surface-container-lowest hover:border-error',
              )}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate font-bold text-on-surface">
                  {row.title || `Item ${index + 1}`}
                </p>
                {row.priceLabel !== null && (
                  <span className="font-headline block text-sm font-bold text-primary">
                    {row.priceLabel}
                  </span>
                )}
                <span
                  className={cn(
                    'block text-sm',
                    row.isAssigned ? 'text-on-surface-variant' : 'text-error',
                  )}
                >
                  {row.splitLabel}
                </span>
              </div>
              <button
                type="button"
                data-testid="wizard-edit-btn"
                onClick={() => onEditItem(index)}
                className="flex shrink-0 items-center gap-1 rounded-xl border border-outline-variant px-3 py-2 text-sm font-semibold text-primary transition-all hover:border-primary hover:bg-primary/5"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                Edit
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
