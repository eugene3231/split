import { useRef, useState } from 'react';
import type { Receipt } from '@shared/types';
import { cn } from '@shared/utils/cn';

interface Props {
  receipts: Receipt[];
  activeTab: string;
  onTabChange: (id: string) => void;
  onRenameReceipt: (id: string, name: string) => void;
  onAddReceipt: () => void;
}

export function SummaryTabs({
  receipts,
  activeTab,
  onTabChange,
  onRenameReceipt,
  onAddReceipt,
}: Props) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState('');
  const tabInputRef = useRef<HTMLInputElement>(null);

  const startEditingTab = (id: string, name: string) => {
    setEditingTabId(id);
    setEditingTabName(name);
    requestAnimationFrame(() => tabInputRef.current?.select());
  };

  const commitTabRename = () => {
    if (editingTabId && editingTabName.trim()) onRenameReceipt(editingTabId, editingTabName.trim());
    setEditingTabId(null);
  };

  return (
    <div
      role="tablist"
      aria-label="Summary receipts"
      className="flex items-end gap-5 overflow-x-auto border-b border-cream-dim/70 pb-0"
      style={{ scrollbarWidth: 'none' }}
    >
      <button
        type="button"
        data-testid="summary-tab-total"
        data-active={activeTab === 'total' ? 'true' : undefined}
        onClick={() => onTabChange('total')}
        className={cn(
          'relative -mb-px flex-shrink-0 px-0 py-3 text-sm font-semibold whitespace-nowrap transition-colors after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:origin-center after:rounded-full after:transition-transform',
          activeTab === 'total'
            ? 'text-ink after:scale-x-100 after:bg-ink'
            : 'text-ink2 after:scale-x-0 hover:text-ink',
        )}
      >
        All
        <span className="ml-1.5 rounded-full bg-cream px-1.5 py-0.5 text-[10px] leading-none text-ink2">
          {receipts.length}r
        </span>
      </button>
      {receipts.map((r, index) => (
        <div
          role="tab"
          tabIndex={0}
          key={r.id}
          data-testid={`summary-tab-receipt-${index}`}
          data-active={activeTab === r.id ? 'true' : undefined}
          aria-selected={activeTab === r.id}
          onClick={() => onTabChange(r.id)}
          onDoubleClick={() => startEditingTab(r.id, r.name || `Receipt ${index + 1}`)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onTabChange(r.id);
            }
          }}
          className={cn(
            'relative -mb-px flex flex-shrink-0 cursor-pointer items-center gap-1.5 px-0 py-3 text-sm font-semibold whitespace-nowrap transition-colors select-none after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:origin-center after:rounded-full after:transition-transform',
            activeTab === r.id
              ? 'text-ink after:scale-x-100 after:bg-ink'
              : 'text-ink2 after:scale-x-0 hover:text-ink',
          )}
        >
          {editingTabId === r.id ? (
            <input
              ref={tabInputRef}
              value={editingTabName}
              onChange={(e) => setEditingTabName(e.target.value)}
              onBlur={commitTabRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTabRename();
                if (e.key === 'Escape') setEditingTabId(null);
              }}
              onClick={(e) => e.stopPropagation()}
              size={Math.max(editingTabName.length, 6)}
              className="max-w-32 bg-transparent font-semibold text-ink outline-none"
              autoFocus
            />
          ) : (
            <>
              {r.name || `Receipt ${index + 1}`}
              <span className="rounded-full bg-cream px-1.5 py-0.5 text-[10px] leading-none text-ink2">
                {index + 1}
              </span>
              {activeTab === r.id && (
                <span
                  className="material-symbols-outlined !text-xs opacity-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditingTab(r.id, r.name || `Receipt ${index + 1}`);
                  }}
                >
                  edit
                </span>
              )}
            </>
          )}
        </div>
      ))}
      <button
        type="button"
        data-testid="summary-add-receipt-btn"
        onClick={onAddReceipt}
        aria-label="Add receipt"
        className="-mb-px flex h-11 w-8 flex-shrink-0 items-center justify-center py-3 text-ink2 transition-colors hover:text-ink"
      >
        <span className="material-symbols-outlined text-lg">add</span>
      </button>
    </div>
  );
}
