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
      className="grid w-full grid-cols-2 rounded-full bg-surface-container-high p-1 text-sm font-semibold sm:inline-grid sm:w-auto"
    >
      {MODES.map((option) => {
        const pressed = option.value === mode;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={pressed}
            onClick={() => onModeChange(option.value)}
            className={cn(
              'rounded-full px-5 py-2 transition-colors',
              pressed
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
