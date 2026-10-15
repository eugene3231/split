import type { ReactNode } from 'react';
import { ReceiptSharingAction } from './ReceiptSharingAction';

interface Props {
  receiptId: string;
  name: string;
  leftCount: number;
  /** Sits before the receipt name in the sticky header. */
  leading?: ReactNode;
  children: ReactNode;
}

export function ReceiptClaimSection({ receiptId, name, leftCount, leading, children }: Props) {
  return (
    <section aria-label={name} data-testid={`claim-section-${receiptId}`}>
      <div className="sticky top-(--app-bar-height) z-10 -mx-6 flex flex-wrap items-center justify-between gap-2 border-b border-surface-container-high bg-surface px-6 pt-4 pb-2 md:mx-0 md:px-1">
        {leading}
        <h2 className="min-w-0 flex-1 truncate text-lg font-bold">{name}</h2>
        {leftCount > 0 && (
          <span
            data-testid={`claim-section-left-${receiptId}`}
            className="shrink-0 rounded-full bg-warning-container px-2.5 py-1 text-xs font-bold text-on-warning-container tabular-nums"
          >
            {leftCount} left
          </span>
        )}
        <ReceiptSharingAction receiptId={receiptId} />
      </div>
      <ul className="divide-y divide-surface-container-high">{children}</ul>
    </section>
  );
}
