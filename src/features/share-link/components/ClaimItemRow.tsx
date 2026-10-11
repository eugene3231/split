import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { cn } from '@shared/utils/cn';
import type { SharedItem } from '../logic/shareLink';

interface ClaimItemRowProps {
  item: SharedItem;
  currency: string;
  splitCount: number | undefined;
  maxSplit: number;
  onToggle: () => void;
  onSplitCountChange: (count: number) => void;
}

export function ClaimItemRow({
  item,
  currency,
  splitCount,
  maxSplit,
  onToggle,
  onSplitCountChange,
}: ClaimItemRowProps) {
  const claimed = splitCount !== undefined;

  return (
    <li
      className={cn(
        'rounded-2xl border-2 bg-surface-container-lowest shadow-sm transition-colors',
        claimed ? 'border-primary' : 'border-transparent',
      )}
    >
      <button
        type="button"
        aria-pressed={claimed}
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span
          className={cn(
            'material-symbols-outlined',
            claimed ? 'text-primary' : 'text-outline-variant',
          )}
        >
          {claimed ? 'check_circle' : 'radio_button_unchecked'}
        </span>
        <span className="min-w-0 flex-1 truncate font-semibold">{item.name}</span>
        <span className="font-semibold text-on-surface-variant">
          {formatCurrencyFromCents(item.cents, currency)}
        </span>
      </button>
      {claimed && (
        <div className="flex items-center justify-between border-t border-outline-variant/40 px-4 py-2">
          <span className="text-sm text-on-surface-variant">
            {splitCount === 1 ? 'Just me' : `Shared between ${splitCount}`}
          </span>
          <div className="flex items-center gap-3">
            <StepButton
              icon="remove"
              label="Fewer people"
              disabled={splitCount <= 1}
              onClick={() => onSplitCountChange(splitCount - 1)}
            />
            <span className="w-6 text-center font-bold">{splitCount}</span>
            <StepButton
              icon="add"
              label="More people"
              disabled={splitCount >= maxSplit}
              onClick={() => onSplitCountChange(splitCount + 1)}
            />
          </div>
        </div>
      )}
    </li>
  );
}

interface StepButtonProps {
  icon: string;
  label: string;
  disabled: boolean;
  onClick: () => void;
}

function StepButton({ icon, label, disabled, onClick }: StepButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container text-on-surface disabled:opacity-30"
    >
      <span className="material-symbols-outlined text-lg">{icon}</span>
    </button>
  );
}
