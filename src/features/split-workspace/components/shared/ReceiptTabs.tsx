import { useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@shared/utils/cn';

interface ReceiptTabsProps {
  children: ReactNode;
  /** Sits beside the tabs, outside the scrolling strip, so it never scrolls out of reach. */
  action?: ReactNode;
  className?: string;
}

/** Browser-style tabs on one baseline; the active tab opens onto the content below. */
export function ReceiptTabs({ children, action, className }: ReceiptTabsProps) {
  return (
    <div className={cn('flex items-end gap-2 border-b border-outline-variant', className)}>
      <div
        role="tablist"
        aria-label="Receipts"
        className="relative -mb-px flex min-w-0 items-end gap-1 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {children}
      </div>
      {action}
    </div>
  );
}

interface ReceiptTabProps {
  label: string;
  isActive: boolean;
  onSelect: () => void;
  onRename?: (name: string) => void;
  onRemove?: () => void;
  'data-testid'?: string;
}

export function ReceiptTab({
  label,
  isActive,
  onSelect,
  onRename,
  onRemove,
  'data-testid': testId,
}: ReceiptTabProps) {
  const [draftName, setDraftName] = useState<string | null>(null);

  const startRenaming = () => {
    if (onRename) setDraftName(label);
  };

  const commitRename = () => {
    if (draftName !== null) onRename?.(draftName);
    setDraftName(null);
  };

  return (
    <div
      role="tab"
      aria-selected={isActive}
      tabIndex={0}
      ref={isActive ? revealInStrip : undefined}
      data-testid={testId}
      data-active={isActive ? 'true' : undefined}
      onClick={onSelect}
      onDoubleClick={startRenaming}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        'flex flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-t-xl border px-4 py-2 text-sm transition-colors select-none',
        isActive
          ? 'border-outline-variant border-b-surface bg-surface font-bold text-on-surface'
          : 'border-transparent border-b-outline-variant bg-surface-container-high/60 font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
      )}
    >
      {draftName !== null ? (
        <input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') setDraftName(null);
          }}
          onClick={(e) => e.stopPropagation()}
          onFocus={(e) => e.currentTarget.select()}
          size={Math.max(draftName.length, 6)}
          className="bg-transparent text-base font-bold outline-none"
          autoFocus
        />
      ) : (
        <>
          <span title={label} className="max-w-40 truncate whitespace-nowrap">
            {label}
          </span>
          {isActive && onRename && (
            <TabIconButton icon="edit" aria-label="Rename receipt" onClick={startRenaming} />
          )}
        </>
      )}
      {onRemove && <TabIconButton icon="close" aria-label={`Remove ${label}`} onClick={onRemove} />}
    </div>
  );
}

function TabIconButton({
  icon,
  onClick,
  ...props
}: { icon: string; onClick: () => void } & Omit<ComponentProps<'button'>, 'onClick'>) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex flex-shrink-0 items-center opacity-40 transition-opacity hover:opacity-100"
      {...props}
    >
      <span aria-hidden="true" className="material-symbols-outlined !text-sm leading-none">
        {icon}
      </span>
    </button>
  );
}

export function AddReceiptButton(props: ComponentProps<'button'>) {
  return (
    <button
      type="button"
      aria-label="Add receipt"
      className="mb-1 flex flex-shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold whitespace-nowrap text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
      {...props}
    >
      <span aria-hidden="true" className="material-symbols-outlined text-lg leading-none">
        add
      </span>
      <span aria-hidden="true" className="hidden md:inline">
        Add receipt
      </span>
    </button>
  );
}

// Scrolls only the strip, never the page, so a tab chosen off-screen comes into view.
function revealInStrip(tab: HTMLDivElement | null) {
  const strip = tab?.parentElement;
  if (!tab || !strip) return;
  const start = tab.offsetLeft;
  const end = start + tab.offsetWidth;
  if (start < strip.scrollLeft) strip.scrollLeft = start;
  else if (end > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = end - strip.clientWidth;
}
