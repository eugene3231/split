import { cn } from '@shared/utils/cn';
import type { Person } from '@shared/types';
import { firstName, formatMoney } from '@features/ux-prototypes/logic/prototypeFormat';
import { Avatar } from '@features/ux-prototypes/components/Avatar';
import { personColor } from '@features/ux-prototypes/logic/personPalette';

interface Props {
  people: Person[];
  totals: Record<string, number>;
  activeIndex: number;
  onSelect: (index: number) => void;
  className?: string;
}

export function ClaimPeopleRail({ people, totals, activeIndex, onSelect, className }: Props) {
  return (
    <div className={cn('flex gap-2', className)}>
      {people.map((person, index) => {
        const active = index === activeIndex;
        return (
          <button
            key={person.id}
            type="button"
            title={person.name}
            aria-pressed={active}
            onClick={() => onSelect(index)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-2xl border-2 bg-white py-1.5 pr-3.5 pl-1.5 text-left transition-all',
              active
                ? 'border-primary shadow-md'
                : 'border-transparent opacity-70 hover:opacity-100',
            )}
          >
            <Avatar name={person.name} color={personColor(index)} className="h-8 w-8 text-sm" />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block max-w-32 truncate text-sm font-bold lg:max-w-none">
                {firstName(person.name)}
              </span>
              <span className="block text-xs text-neutral-500 tabular-nums">
                {formatMoney(totals[person.id])}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
