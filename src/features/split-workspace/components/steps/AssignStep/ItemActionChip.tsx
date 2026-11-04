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
      className="flex h-8 min-w-0 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold text-on-surface-variant transition-colors hover:text-on-surface disabled:bg-surface-container-lowest disabled:text-on-surface disabled:shadow-[0_1px_2px_rgba(23,28,39,0.08)] disabled:ring-1 disabled:ring-surface-container-highest sm:px-3"
    >
      {/* The icon font's own stylesheet sets display, so the wrapper hides it on phones. */}
      <span aria-hidden className="hidden sm:flex">
        <span className="material-symbols-outlined text-base!">{icon}</span>
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}
