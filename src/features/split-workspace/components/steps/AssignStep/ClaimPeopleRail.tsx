import { cn } from '@shared/utils/cn';
import { personColor } from '@shared/utils/personColors';
import type { ClaimPerson } from '@features/split-workspace/logic/claim';
import { PersonAvatar } from '@features/split-workspace/components/shared/PersonAvatar';
import { CountUpAmount } from '@features/split-workspace/components/shared/CountUpAmount';
import { prefersMotion } from '@features/split-workspace/components/shared/motion';
import type { CurrencyCode } from '@shared/constants';

interface Props {
  people: ClaimPerson[];
  onSelect: (personId: string) => void;
  layout: 'row' | 'column';
  currency: CurrencyCode;
  className?: string;
}

function scrollIntoRail(element: HTMLButtonElement | null) {
  element?.scrollIntoView?.({
    behavior: prefersMotion() ? 'smooth' : 'auto',
    block: 'nearest',
    inline: 'center',
  });
}

export function ClaimPeopleRail({ people, onSelect, layout, currency, className }: Props) {
  return (
    <div
      role="group"
      aria-label="Whose items"
      className={cn('flex gap-2', layout === 'column' && 'flex-col', className)}
    >
      {people.map((person) => (
        <button
          key={person.id}
          ref={person.isActive ? scrollIntoRail : undefined}
          type="button"
          title={person.name}
          aria-pressed={person.isActive}
          data-testid={`claim-person-${person.id}`}
          onClick={() => onSelect(person.id)}
          style={
            person.isActive && layout === 'row'
              ? {
                  borderColor: personColor(person.colorIndex),
                  boxShadow: `0 0 0 1px ${personColor(person.colorIndex)}`,
                }
              : undefined
          }
          className={cn(
            'flex shrink-0 items-center gap-3 rounded-xl border pr-3.5 pl-1.5 text-left transition-colors',
            layout === 'column' ? 'w-full py-1' : 'bg-surface-container-lowest py-1.5',
            person.isActive
              ? layout === 'column'
                ? 'border-transparent bg-surface-container'
                : ''
              : cn(
                  'text-on-surface-variant hover:text-on-surface',
                  layout === 'column'
                    ? 'border-transparent hover:bg-surface-container-low'
                    : 'border-surface-container-highest',
                ),
          )}
        >
          <PersonAvatar name={person.name} colorIndex={person.colorIndex} className="h-8 w-8" />
          <span className="min-w-12 flex-1 leading-tight">
            <span
              className={cn(
                'block truncate text-sm',
                person.isActive ? 'font-bold' : 'font-semibold',
                layout === 'row' && 'max-w-32',
              )}
            >
              {layout === 'row' ? person.firstName : person.name}
            </span>
            <CountUpAmount
              cents={person.totalCents}
              currency={currency}
              className="block text-xs text-on-surface-variant tabular-nums"
            />
          </span>
        </button>
      ))}
    </div>
  );
}
