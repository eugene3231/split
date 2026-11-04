import { ToggleGroup } from 'radix-ui';
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
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(next: T | '') => next && onChange(next)}
      className={cn(
        'flex items-center gap-0.5 rounded-xl bg-surface-container p-0.5 text-xs font-semibold',
        className,
      )}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          className="flex flex-1 items-center justify-center rounded-[10px] px-3 py-1.5 whitespace-nowrap text-on-surface-variant transition-colors hover:text-on-surface data-[state=on]:bg-surface-container-lowest data-[state=on]:text-on-surface data-[state=on]:shadow-[0_1px_2px_rgba(23,28,39,0.08)]"
        >
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
