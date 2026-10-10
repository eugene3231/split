import { cn } from '@shared/utils/cn';
import type { ClaimPerson } from '@features/split-workspace/logic/claim';
import { PersonAvatar } from '@features/split-workspace/components/shared/PersonAvatar';

interface Props {
  people: ClaimPerson[];
  onSelect: (personId: string) => void;
  layout: 'row' | 'column';
  className?: string;
}

function scrollIntoRail(element: HTMLButtonElement | null) {
  element?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

export function ClaimPeopleRail({ people, onSelect, layout, className }: Props) {
  return (
    <div
      role="group"
      aria-label="Who is claiming"
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
          className={cn(
            'flex shrink-0 items-center gap-2 rounded-2xl border-2 bg-surface-container-lowest py-1.5 pr-3.5 pl-1.5 text-left transition-all',
            layout === 'column' && 'w-full',
            person.isActive
              ? 'border-primary shadow-md'
              : 'border-transparent opacity-70 hover:opacity-100',
          )}
        >
          <PersonAvatar name={person.name} colorIndex={person.colorIndex} className="h-8 w-8" />
          <span className="min-w-0 flex-1 leading-tight">
            <span
              className={cn('block truncate text-sm font-bold', layout === 'row' && 'max-w-32')}
            >
              {layout === 'row' ? person.firstName : person.name}
            </span>
            <span className="block text-xs text-on-surface-variant tabular-nums">
              {person.totalLabel}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
