import type { ReactNode } from 'react';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { PersonAvatar } from '@features/split-workspace/components/shared/PersonAvatar';
import { prefersMotion } from '@features/split-workspace/components/shared/motion';
import type { PersonBreakdown } from '@features/split-workspace/summary/breakdown/types';

function personBreakdownElementId(personId: string): string {
  return `person-breakdown-${personId}`;
}

/** Wraps a person's card so the list below can scroll to it. */
export function PersonBreakdownAnchor({
  personId,
  children,
}: {
  personId: string;
  children: ReactNode;
}) {
  return (
    <div
      id={personBreakdownElementId(personId)}
      className="scroll-mt-[calc(var(--app-bar-height)+1.5rem)]"
    >
      {children}
    </div>
  );
}

function scrollToBreakdown(personId: string) {
  document.getElementById(personBreakdownElementId(personId))?.scrollIntoView?.({
    behavior: prefersMotion() ? 'smooth' : 'auto',
    block: 'start',
  });
}

interface Props {
  breakdowns: PersonBreakdown[];
}

/** React only: an index of the cards beside them. docs/EXPORT-PARITY.md lists it. */
export function PersonTotalsList({ breakdowns }: Props) {
  return (
    <nav aria-labelledby="person-totals-heading" className="surface-card p-2">
      <h2 id="person-totals-heading" className="px-2 pt-2 pb-3 section-label">
        Who owes what
      </h2>
      <ul className="max-h-[calc(100dvh-var(--app-bar-height)-9rem)] overflow-y-auto">
        {breakdowns.map((breakdown) => (
          <li key={breakdown.person.id}>
            <button
              type="button"
              data-testid={`person-total-${breakdown.person.id}`}
              onClick={() => scrollToBreakdown(breakdown.person.id)}
              className="flex w-full items-center gap-3 rounded-xl py-1 pr-2.5 pl-1.5 text-left transition-colors hover:bg-surface-container-low"
            >
              <PersonAvatar
                name={breakdown.person.name}
                colorIndex={breakdown.colorIndex}
                className="h-8 w-8"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-on-surface">
                {breakdown.person.name}
              </span>
              <span className="text-sm font-semibold text-on-surface tabular-nums">
                {formatCurrencyFromCents(breakdown.totalCents, breakdown.currency)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
