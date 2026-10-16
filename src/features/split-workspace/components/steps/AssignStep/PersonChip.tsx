import type { ClaimChip } from '@features/split-workspace/logic/claim';
import { PersonAvatar } from '@features/split-workspace/components/shared/PersonAvatar';
import { personColor } from '@shared/utils/personColors';
import { cn } from '@shared/utils/cn';

interface Props {
  chip: ClaimChip;
  onToggle: () => void;
  testId: string;
}

/** Fills its grid cell, so a tap that adds or changes an amount never moves another chip. */
export function PersonChip({ chip, onToggle, testId }: Props) {
  const { person, selected } = chip;

  return (
    <button
      type="button"
      title={person.name}
      aria-pressed={selected}
      data-testid={testId}
      onClick={onToggle}
      className={cn(
        'flex h-12 min-w-0 items-center gap-2 rounded-2xl border-2 py-1 pr-2 pl-1 text-left transition-colors',
        selected
          ? 'border-transparent text-white'
          : 'border-surface-container-high bg-surface-container-lowest text-on-surface-variant hover:text-on-surface',
      )}
      style={selected ? { backgroundColor: personColor(person.colorIndex) } : undefined}
    >
      <PersonAvatar
        name={person.name}
        colorIndex={person.colorIndex}
        className={cn('h-8 w-8 shrink-0', selected && 'bg-white/25!')}
      />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-semibold">{person.firstName}</span>
        {chip.selected && (
          <span className="block truncate text-xs tabular-nums opacity-85 motion-safe:animate-fade-in">
            {chip.amountLabel}
          </span>
        )}
      </span>
    </button>
  );
}
