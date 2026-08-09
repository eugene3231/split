import { cn } from '@shared/utils/cn';

type SplitEquallyButtonProps = {
  onClick: () => void;
  disabled: boolean;
};

// Always mounted (invisible + disabled when <2 selected) so the header row
// never jumps height as people are selected/deselected.
export function SplitEquallyButton({ onClick, disabled }: SplitEquallyButtonProps) {
  return (
    <button
      type="button"
      data-testid="assign-split-equally-btn"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-7 items-center rounded-md bg-surface-container-low px-2 text-xs font-semibold whitespace-nowrap text-on-surface-variant transition-colors hover:bg-surface-container',
        disabled && 'invisible',
      )}
    >
      Split equally
    </button>
  );
}
