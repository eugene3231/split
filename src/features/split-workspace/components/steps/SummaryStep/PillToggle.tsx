import { Fragment } from 'react';
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
        const button = (
          <button
            type="button"
            aria-pressed={pressed}
            aria-label={option.icon ? option.label : undefined}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex flex-1 items-center justify-center rounded-full px-3 py-1.5 whitespace-nowrap transition-all',
              pressed
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface',
            )}
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
          </button>
        );

        if (!option.icon) return <Fragment key={option.value}>{button}</Fragment>;

        return (
          <HoverLabel key={option.value} label={option.label} showOnTap labelClassName="sm:hidden">
            {button}
          </HoverLabel>
        );
      })}
    </div>
  );
}
