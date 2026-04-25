import { useRef, useState } from 'react';
import { cn } from '@shared/utils/cn';

interface Receipt {
  id: string;
  name: string;
}

interface AppendTab {
  icon: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

interface Props {
  receipts: Receipt[];
  activeReceiptId: string;
  onSelect: (id: string) => void;
  onAdd?: () => void;
  onRemove?: (id: string) => void;
  onRename?: (id: string, name: string) => void;
  appendTab?: AppendTab;
}

export function ReceiptTabs({
  receipts,
  activeReceiptId,
  onSelect,
  onAdd,
  onRemove,
  onRename,
  appendTab,
}: Props) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState('');
  const tabInputRef = useRef<HTMLInputElement>(null);

  const handleDoubleClick = (id: string, currentName: string) => {
    if (!onRename) return;
    setEditingTabId(id);
    setEditingTabName(currentName);
    requestAnimationFrame(() => tabInputRef.current?.select());
  };

  const commitRename = () => {
    if (editingTabId && onRename) onRename(editingTabId, editingTabName);
    setEditingTabId(null);
  };

  return (
    <div className="mb-8 flex items-center gap-3">
      {/* Segmented pill */}
      <div className="flex items-center gap-0.5 overflow-x-auto rounded-xl bg-surface-container-low p-1">
        {receipts.map((receipt) => {
          const isActive = receipt.id === activeReceiptId;
          return (
            <div
              role="button"
              tabIndex={0}
              key={receipt.id}
              onClick={() => onSelect(receipt.id)}
              onDoubleClick={() => handleDoubleClick(receipt.id, receipt.name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(receipt.id);
                }
              }}
              className={cn(
                'group relative flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-1.5 transition-all select-none',
                isActive
                  ? 'bg-white text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface',
              )}
            >
              {editingTabId === receipt.id ? (
                <input
                  ref={tabInputRef}
                  value={editingTabName}
                  onChange={(e) => setEditingTabName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditingTabId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-24 bg-transparent text-sm font-bold outline-none"
                  autoFocus
                />
              ) : (
                <>
                  <span
                    className={cn(
                      'text-sm whitespace-nowrap',
                      isActive ? 'font-bold' : 'font-semibold',
                    )}
                  >
                    {receipt.name}
                  </span>
                  {isActive && onRename && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDoubleClick(receipt.id, receipt.name);
                      }}
                      aria-label="Rename receipt"
                      className="flex flex-shrink-0 items-center opacity-40 transition-opacity hover:opacity-100"
                    >
                      <span className="material-symbols-outlined !text-sm leading-none">edit</span>
                    </button>
                  )}
                </>
              )}
              {receipts.length > 1 && onRemove && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(receipt.id);
                  }}
                  aria-label={`Remove ${receipt.name}`}
                  className="flex h-3.5 w-3.5 flex-shrink-0 opacity-40 transition-opacity hover:opacity-100"
                >
                  <span className="material-symbols-outlined cursor-pointer !text-base leading-none">
                    close
                  </span>
                </button>
              )}
            </div>
          );
        })}

        {appendTab && (
          <button
            type="button"
            onClick={appendTab.onClick}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-lg px-4 py-1.5 transition-all select-none',
              appendTab.isActive
                ? 'bg-white font-bold text-on-surface shadow-sm'
                : 'font-semibold text-on-surface-variant hover:text-on-surface',
            )}
          >
            <span className="material-symbols-outlined text-sm">{appendTab.icon}</span>
            <span className="text-sm whitespace-nowrap">{appendTab.label}</span>
          </button>
        )}
      </div>

      {/* Add receipt — outside the pill */}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 whitespace-nowrap text-on-surface-variant transition-all hover:bg-surface-container-low hover:text-primary"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          <span className="text-sm font-semibold">Add</span>
        </button>
      )}
    </div>
  );
}
