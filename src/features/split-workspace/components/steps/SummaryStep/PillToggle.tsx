import { Fragment } from 'react';
import { ToggleGroup } from 'radix-ui';
import type { ReactNode } from 'react';
import { HoverLabel } from '@features/split-workspace/components/shared/HoverLabel';
import { cn } from '@shared/utils/cn';

interface PillToggleOption<T extends string> {
  value: T;
  label: string;
  /** Shown instead of the label on phones, which name it on tap or long press. */
  icon?: ReactNode;
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
        'flex items-center gap-1 rounded-full bg-surface-container p-0.5 text-xs font-semibold',
        className,
      )}
    >
      {options.map((option) => {
        const item = (
          <ToggleGroup.Item
            value={option.value}
            aria-label={option.icon ? option.label : undefined}
            className="flex flex-1 items-center justify-center rounded-full px-3 py-1.5 whitespace-nowrap text-on-surface-variant transition-all hover:text-on-surface data-[state=on]:bg-primary data-[state=on]:text-on-primary data-[state=on]:shadow-sm"
          >
            {option.icon ? (
              <>
                <span aria-hidden="true" className="flex sm:hidden">
                  <span className="material-symbols-outlined text-base leading-4">
                    {option.icon}
                  </span>
                </span>
                <span aria-hidden="true" className="hidden sm:inline">
                  {option.label}
                </span>
              </>
            ) : (
              option.label
            )}
          </ToggleGroup.Item>
        );

        if (!option.icon) return <Fragment key={option.value}>{item}</Fragment>;

        return (
          <HoverLabel key={option.value} label={option.label} showOnTap labelClassName="sm:hidden">
            {item}
          </HoverLabel>
        );
      })}
    </ToggleGroup.Root>
  );
}
