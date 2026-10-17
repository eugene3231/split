import { cn } from '@shared/utils/cn';
import type { Person, SplitResult } from '@shared/types';
import { formatMoney } from '@features/ux-prototypes/logic/prototypeFormat';
import { personColor } from '@features/ux-prototypes/logic/personPalette';
import { Avatar } from '@features/ux-prototypes/components/Avatar';

interface Props {
  people: Person[];
  split: SplitResult;
  className?: string;
}

export function OverviewSettlePanel({ people, split, className }: Props) {
  const [payer, ...others] = people;

  return (
    <section
      aria-label="Settle up"
      className={cn(
        'h-fit rounded-xl border border-overview-line bg-overview-panel p-4',
        className,
      )}
    >
      <h2 className="text-sm font-semibold">Settle up</h2>
      <p className="mt-0.5 text-xs text-overview-muted">
        Everyone pays <span className="font-medium text-overview-ink">{payer.name}</span>
      </p>
      <ul className="mt-4 space-y-3">
        {others.map((person, index) => (
          <li key={person.id} className="flex items-center gap-2.5 text-sm">
            <Avatar name={person.name} color={personColor(index + 1)} className="h-7 w-7 text-xs" />
            <span className="min-w-0 flex-1 truncate" title={person.name}>
              {person.name}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">
              {formatMoney(split.totalByPersonCents[person.id])}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm font-semibold">
        <button type="button" className="rounded-lg bg-ink py-2.5 text-on-ink">
          Copy as text
        </button>
        <button type="button" className="rounded-lg border border-overview-line py-2.5">
          PayNow QR
        </button>
      </div>
    </section>
  );
}
