import { ToggleGroup } from 'radix-ui';
import { cn } from '@shared/utils/cn';

export type SummaryMode = 'by-person' | 'overview';

const MODES: { value: SummaryMode; label: string }[] = [
  { value: 'by-person', label: 'By person' },
  { value: 'overview', label: 'Overview' },
];

interface Props {
  mode: SummaryMode;
  onModeChange: (mode: SummaryMode) => void;
}

export function SummaryModeToggle({ mode, onModeChange }: Props) {
  return (
    <ToggleGroup.Root
      type="single"
      aria-label="Summary view"
      value={mode}
      onValueChange={(value: SummaryMode | '') => value && onModeChange(value)}
      className="relative grid w-full grid-cols-2 rounded-full bg-surface-container-high p-1 text-sm font-semibold sm:inline-grid sm:w-auto"
    >
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-surface-container-lowest shadow-sm motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-(--ease-out-quart)',
          mode === 'overview' && 'translate-x-full',
        )}
      />
      {MODES.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          className="relative rounded-full px-5 py-2 text-on-surface-variant transition-colors hover:text-on-surface data-[state=on]:text-on-surface"
        >
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
