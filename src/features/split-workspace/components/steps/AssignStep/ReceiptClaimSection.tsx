import type { ReactNode } from 'react';
import { ReceiptSharingAction } from './ReceiptSharingAction';

interface Props {
  receiptId: string;
  name: string;
  leftCount: number;
  /** What sits left of the name, in the same column as each row's leading mark. */
  leading: ReactNode;
  children: ReactNode;
}

export function ReceiptClaimSection({ receiptId, name, leftCount, leading, children }: Props) {
  return (
    <section aria-label={name} data-testid={`claim-section-${receiptId}`} className="surface-card">
      <div className="sticky top-(--app-bar-height) z-10 flex flex-wrap items-center justify-between gap-2 rounded-t-card border-b border-surface-container-high bg-surface-container-lowest px-4 pt-3 pb-2">
        <span className="-mr-0.5 -ml-1.5 flex h-9 w-9 shrink-0 items-center justify-center md:-ml-2.5">
          {leading}
        </span>
        <h2 className="min-w-0 flex-1 truncate font-headline text-lg font-bold">{name}</h2>
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
      <ul className="divide-y divide-surface-container-high px-4">{children}</ul>
    </section>
  );
}
