import { useEffect, useRef, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { Tabs } from 'radix-ui';
import { cn } from '@shared/utils/cn';

interface ReceiptTabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  /** Sits beside the tabs, outside the scrolling strip, so it never scrolls out of reach. */
  action?: ReactNode;
  className?: string;
}

/** Browser-style tabs on one baseline; the active tab opens onto the content below. */
export function ReceiptTabs({
  value,
  onValueChange,
  children,
  action,
  className,
}: ReceiptTabsProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Scrolls only the strip, never the page, so a tab chosen off-screen comes into view.
  useEffect(() => {
    const strip = listRef.current;
    const tab = strip?.querySelector<HTMLElement>('[data-state="active"]');
    if (!strip || !tab) return;
    const start = tab.offsetLeft;
    const end = start + tab.offsetWidth;
    if (start < strip.scrollLeft) strip.scrollLeft = start;
    else if (end > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = end - strip.clientWidth;
  }, [value]);

  return (
    <Tabs.Root
      value={value}
      onValueChange={onValueChange}
      className={cn('flex items-end gap-2 border-b border-outline-variant', className)}
    >
      <Tabs.List
        ref={listRef}
        aria-label="Receipts"
        className="relative -mb-px flex min-w-0 items-end gap-1 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {children}
      </Tabs.List>
      {action}
    </Tabs.Root>
  );
}

interface ReceiptTabProps {
  value: string;
  label: string;
  onRename?: (name: string) => void;
  onRemove?: () => void;
  'data-testid'?: string;
}

export function ReceiptTab({
  value,
  label,
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
    // A div, not a button, because the tab holds its own rename and remove buttons.
    // The receipt's content is not a tab panel, so there is nothing for aria-controls to name.
    <Tabs.Trigger
      value={value}
      asChild
      type={undefined}
      aria-controls={undefined}
      data-testid={testId}
    >
      <div
        onDoubleClick={startRenaming}
        className={cn(
          'group flex flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-t-xl border px-4 py-2 text-sm transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset',
          'border-transparent border-b-outline-variant bg-surface-container-high/60 font-semibold text-on-surface-variant data-[state=inactive]:hover:bg-surface-container-high data-[state=inactive]:hover:text-on-surface',
          'data-[state=active]:border-outline-variant data-[state=active]:border-b-surface data-[state=active]:bg-surface data-[state=active]:font-bold data-[state=active]:text-on-surface',
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
            onMouseDown={(e) => e.stopPropagation()}
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
            {onRename && (
              <TabIconButton
                icon="edit"
                aria-label="Rename receipt"
                onClick={startRenaming}
                className="hidden group-data-[state=active]:flex"
              />
            )}
          </>
        )}
        {onRemove && (
          <TabIconButton icon="close" aria-label={`Remove ${label}`} onClick={onRemove} />
        )}
      </div>
    </Tabs.Trigger>
  );
}

function TabIconButton({
  icon,
  onClick,
  className,
  ...props
}: { icon: string; onClick: () => void } & Omit<ComponentProps<'button'>, 'onClick'>) {
  return (
    <button
      type="button"
      // Keeps the press from also selecting the tab underneath.
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'flex flex-shrink-0 items-center opacity-40 transition-opacity hover:opacity-100',
        className,
      )}
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
