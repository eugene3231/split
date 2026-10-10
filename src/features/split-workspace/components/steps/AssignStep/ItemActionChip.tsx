interface Props {
  label: string;
  disabled: boolean;
  onClick: () => void;
  testId: string;
}

export function ItemActionChip({ label, disabled, onClick, testId }: Props) {
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className="h-8.5 rounded-full border border-outline-variant px-3 text-xs font-semibold whitespace-nowrap transition-colors hover:bg-surface-container disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {label}
    </button>
  );
}
