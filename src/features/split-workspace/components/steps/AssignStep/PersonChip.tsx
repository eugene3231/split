import type { ClaimChip } from '@features/split-workspace/logic/claim';
import { PersonAvatar } from '@features/split-workspace/components/shared/PersonAvatar';
import { personColor } from '@shared/utils/personColors';
import { cn } from '@shared/utils/cn';

interface Props {
  chip: ClaimChip;
  onToggle: () => void;
  testId: string;
}

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
        'flex min-h-10 items-center gap-1.5 rounded-full border-2 py-0.5 pr-3 pl-0.5 text-sm font-semibold transition-colors',
        selected
          ? 'border-transparent text-white'
          : 'border-surface-container-high bg-surface-container-lowest text-on-surface-variant hover:text-on-surface',
      )}
      style={selected ? { backgroundColor: personColor(person.colorIndex) } : undefined}
    >
      <PersonAvatar
        name={person.name}
        colorIndex={person.colorIndex}
        className={cn('h-8 w-8', selected && 'bg-white/25!')}
      />
      {person.firstName}
      {chip.selected && (
        <span className="font-normal tabular-nums opacity-80 motion-safe:animate-fade-in">
          {chip.amountLabel}
        </span>
      )}
    </button>
  );
}
