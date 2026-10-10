import { cn } from '@shared/utils/cn';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import type { Person } from '@shared/types';
import { Avatar } from '@features/ux-prototypes/components/Avatar';
import { claimColor } from './claimPalette';

interface Props {
  people: Person[];
  totals: Record<string, number>;
  activeIndex: number;
  onSelect: (index: number) => void;
}

export function ClaimPeopleRail({ people, totals, activeIndex, onSelect }: Props) {
  return (
    <div className="-mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1">
      {people.map((person, index) => {
        const active = index === activeIndex;
        return (
          <button
            key={person.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(index)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-2xl border-2 bg-white py-1.5 pr-3.5 pl-1.5 transition-all',
              active ? 'shadow-md' : 'border-transparent opacity-70',
            )}
            style={active ? { borderColor: claimColor(index) } : undefined}
          >
            <Avatar name={person.name} color={claimColor(index)} className="h-8 w-8 text-sm" />
            <span className="text-left leading-tight">
              <span className="block text-sm font-bold">{person.name}</span>
              <span className="block text-xs text-neutral-500 tabular-nums">
                {formatCurrencyFromCents(totals[person.id])}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
