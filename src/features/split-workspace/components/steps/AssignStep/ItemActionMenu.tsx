import { useRef, useState } from 'react';
import { useMenuDismiss } from '@features/split-workspace/hooks/useMenuDismiss';

interface Action {
  icon: string;
  label: string;
  disabled: boolean;
  onSelect: () => void;
  testId: string;
}

interface Props {
  actions: Action[];
  testId: string;
}

/** The row's less common share actions behind one button, so a narrow row stays readable. */
export function ItemActionMenu({ actions, testId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const close = () => setIsOpen(false);
  useMenuDismiss(containerRef, isOpen, close);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="More share options"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        data-testid={testId}
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
      >
        <span aria-hidden className="material-symbols-outlined text-xl">
          more_horiz
        </span>
      </button>
      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 bottom-full z-20 mb-1 w-48 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-1.5 shadow-xl"
        >
          {actions.map((action) => (
            <button
              key={action.testId}
              type="button"
              role="menuitem"
              data-testid={`${action.testId}-menu-item`}
              disabled={action.disabled}
              onClick={() => {
                close();
                action.onSelect();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-surface-container-low disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <span
                aria-hidden
                className="material-symbols-outlined text-lg text-on-surface-variant"
              >
                {action.icon}
              </span>
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
