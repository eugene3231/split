import { cn } from '@shared/utils/cn';
import { useLongPress } from './useLongPress';

interface Props {
  icon: string;
  label: string;
  disabled: boolean;
  onClick: () => void;
  testId: string;
}

/** An icon button whose label shows on hover, or on a long press on touch screens. */
export function ItemActionChip({ icon, label, disabled, onClick, testId }: Props) {
  const { pressed, handlers } = useLongPress();

  return (
    // The wrapper takes the hover and press, so a disabled button still shows its label.
    <span className="group relative flex select-none [-webkit-touch-callout:none]" {...handlers}>
      <button
        type="button"
        aria-label={label}
        data-testid={testId}
        disabled={disabled}
        onClick={onClick}
        className="flex h-8.5 w-8.5 items-center justify-center rounded-full border border-outline-variant text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <span aria-hidden className="material-symbols-outlined text-lg">
          {icon}
        </span>
      </button>
      <span
        aria-hidden
        data-testid={`${testId}-label`}
        className={cn(
          'pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 rounded-lg bg-inverse-surface px-2 py-1 text-xs font-semibold whitespace-nowrap text-inverse-on-surface opacity-0 transition-opacity group-hover:opacity-100',
          pressed && 'opacity-100',
        )}
      >
        {label}
      </span>
    </span>
  );
}
