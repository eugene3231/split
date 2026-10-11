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
    <div
      role="group"
      aria-label="Summary view"
      className="relative grid w-full grid-cols-2 rounded-full bg-surface-container-high p-1 text-sm font-semibold sm:inline-grid sm:w-auto"
    >
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-surface-container-lowest shadow-sm motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-(--ease-out-quart)',
          mode === 'overview' && 'translate-x-full',
        )}
      />
      {MODES.map((option) => {
        const pressed = option.value === mode;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={pressed}
            onClick={() => onModeChange(option.value)}
            className={cn(
              'relative rounded-full px-5 py-2 transition-colors',
              pressed ? 'text-on-surface' : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
