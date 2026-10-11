interface Props {
  icon: string;
  label: string;
  disabled: boolean;
  onClick: () => void;
  testId: string;
}

export function ItemActionChip({ icon, label, disabled, onClick, testId }: Props) {
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 min-w-0 items-center gap-1 rounded-full border border-outline-variant px-3 text-xs font-semibold whitespace-nowrap text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {/* Narrow rows drop the icon so both labels fit beside the avatars. */}
      <span aria-hidden className="hidden md:flex">
        <span className="material-symbols-outlined text-base">{icon}</span>
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}
