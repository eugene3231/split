import { ToggleGroup } from 'radix-ui';
import { cn } from '@shared/utils/cn';

interface Option<Value extends string> {
  value: Value;
  label: string;
}

interface Props<Value extends string> {
  label: string;
  options: readonly [Option<Value>, Option<Value>];
  value: Value;
  onValueChange: (value: Value) => void;
  className?: string;
}

export function SegmentedToggle<Value extends string>({
  label,
  options,
  value,
  onValueChange,
  className,
}: Props<Value>) {
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(next: Value | '') => next && onValueChange(next)}
      className={cn(
        'relative inline-grid grid-cols-2 rounded-full bg-surface-container-high p-1 text-sm font-semibold',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-surface-container-lowest shadow-sm motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-(--ease-out-quart)',
          value === options[1].value && 'translate-x-full',
        )}
      />
      {options.map((option) => (
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
