import { HoverLabel } from './HoverLabel';

interface Props {
  icon: string;
  label: string;
  disabled: boolean;
  onClick: () => void;
  testId: string;
}

export function ItemActionChip({ icon, label, disabled, onClick, testId }: Props) {
  return (
    <HoverLabel label={label} testId={`${testId}-label`}>
      <button
        type="button"
        aria-label={label}
        data-testid={testId}
        disabled={disabled}
        onClick={onClick}
        className="flex h-11 items-center justify-center gap-2 rounded-full border border-outline-variant px-3 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:opacity-30 disabled:hover:bg-transparent md:w-11 md:px-0"
      >
        <span aria-hidden className="material-symbols-outlined text-lg">
          {icon}
        </span>
        <span className="text-sm font-semibold md:hidden">{label}</span>
      </button>
    </HoverLabel>
  );
}
