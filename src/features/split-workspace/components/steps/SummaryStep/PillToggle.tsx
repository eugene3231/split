import { cn } from '@shared/utils/cn';

interface PillToggleOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  label: string;
  options: PillToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function PillToggle<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: Props<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'flex items-center gap-1 rounded-full bg-surface-container p-0.5 text-xs font-semibold',
        className,
      )}
    >
      {options.map((option) => {
        const pressed = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex-1 rounded-full px-3 py-1.5 whitespace-nowrap transition-all',
              pressed
                ? 'bg-primary text-on-primary shadow-sm'
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
