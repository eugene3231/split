interface Props {
  icon: string;
  label: string;
  /** What the chip does, for screen readers and hover; the visible label stays short. */
  description: string;
  disabled: boolean;
  onClick: () => void;
  testId: string;
}

export function ItemActionChip({ icon, label, description, disabled, onClick, testId }: Props) {
  return (
    <button
      type="button"
      aria-label={description}
      title={description}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 min-w-0 items-center gap-1 rounded-full bg-surface-container px-3 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-35 disabled:hover:bg-surface-container"
    >
      {/* The icon font's own stylesheet sets display, so the wrapper hides it on phones. */}
      <span aria-hidden className="hidden sm:flex">
        <span className="material-symbols-outlined text-base!">{icon}</span>
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}
