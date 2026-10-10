interface Props {
  label: string;
  onClick: () => void;
  testId: string;
}

// Keeps focus in the share input, so tapping the chip doesn't blur and close the editor first.
const keepInputFocus = (event: { preventDefault: () => void }) => event.preventDefault();

export function TreatChip({ label, onClick, testId }: Props) {
  return (
    <button
      type="button"
      data-testid={testId}
      onPointerDown={keepInputFocus}
      onMouseDown={keepInputFocus}
      onClick={onClick}
      className="flex items-center gap-1 rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1 text-xs font-semibold transition-colors hover:bg-surface-container"
    >
      <span aria-hidden className="material-symbols-outlined text-sm">
        redeem
      </span>
      {label}
    </button>
  );
}
