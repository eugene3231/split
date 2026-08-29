import { useRef, useState } from 'react';
import type { Receipt } from '@shared/types';
import { cn } from '@shared/utils/cn';

interface Props {
  receipts: Receipt[];
  activeTab: string;
  onTabChange: (id: string) => void;
  onRenameReceipt: (id: string, name: string) => void;
}

export function SummaryTabs({ receipts, activeTab, onTabChange, onRenameReceipt }: Props) {
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
    <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
      <button
        type="button"
        data-testid="summary-tab-total"
        data-active={activeTab === 'total' ? 'true' : undefined}
        onClick={() => onTabChange('total')}
        className={cn(
          'flex-shrink-0 rounded-full px-6 py-2.5 font-bold transition-all',
          activeTab === 'total'
            ? 'bg-primary text-on-primary shadow-md shadow-primary/20'
            : 'bg-surface-container-high font-semibold text-on-surface-variant hover:bg-surface-container-highest',
        )}
      >
        Total ({receipts.length} receipts)
      </button>
      {receipts.map((r, index) => (
        <div
          role="button"
          tabIndex={0}
          key={r.id}
          data-testid={`summary-tab-receipt-${index}`}
          data-active={activeTab === r.id ? 'true' : undefined}
          onClick={() => onTabChange(r.id)}
          onDoubleClick={() => startEditingTab(r.id, r.name || `Receipt ${index + 1}`)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onTabChange(r.id);
            }
          }}
          className={cn(
            'flex flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-6 py-2.5 font-semibold transition-all select-none',
            activeTab === r.id
              ? 'bg-primary text-on-primary shadow-md shadow-primary/20'
              : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest',
          )}
        >
          {editingTabId === r.id ? (
            <input
              ref={tabInputRef}
              value={editingTabName}
              onChange={(e) => setEditingTabName(e.target.value)}
              onBlur={commitTabRename}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') commitTabRename();
                if (e.key === 'Escape') setEditingTabId(null);
              }}
              onClick={(e) => e.stopPropagation()}
              size={Math.max(editingTabName.length, 6)}
              className="bg-transparent font-semibold text-on-primary outline-none"
              autoFocus
            />
          ) : (
            <>
              {r.name || `Receipt ${index + 1}`}
              {activeTab === r.id && (
                <span
                  className="material-symbols-outlined !text-xs opacity-70"
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
    </div>
  );
}
