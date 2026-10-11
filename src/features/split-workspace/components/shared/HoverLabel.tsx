import type { ReactNode } from 'react';
import { cn } from '@shared/utils/cn';
import { useLongPress } from './useLongPress';

interface Props {
  label: string;
  testId?: string;
  /** Also show the label on a plain tap, for children that have no click of their own. */
  showOnTap?: boolean;
  labelClassName?: string;
  children: ReactNode;
}

/** Shows a label above its children on hover, or on a long press on touch screens. */
export function HoverLabel({ label, testId, showOnTap = false, labelClassName, children }: Props) {
  const { pressed, toggle, handlers } = useLongPress();

  return (
    // The wrapper takes the hover and press, so a disabled button inside still shows its label.
    <span
      className="relative flex select-none [-webkit-touch-callout:none]"
      {...handlers}
      onClick={showOnTap ? toggle : undefined}
    >
      {children}
      <span
        aria-hidden
        data-testid={testId}
        className={cn(
          'pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 rounded-lg bg-inverse-surface px-2 py-1 text-xs font-semibold whitespace-nowrap text-inverse-on-surface opacity-0',
          pressed && 'opacity-100',
          labelClassName,
        )}
      >
        {label}
      </span>
    </span>
  );
}
