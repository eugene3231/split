import { useRef, useState } from 'react'
import { cn } from '@shared/utils/cn'

interface Receipt {
  id: string
  name: string
}

interface AppendTab {
  icon: string
  label: string
  isActive: boolean
  onClick: () => void
}

interface Props {
  receipts: Receipt[]
  activeReceiptId: string
  onSelect: (id: string) => void
  onAdd?: () => void
  onRemove?: (id: string) => void
  onRename?: (id: string, name: string) => void
  appendTab?: AppendTab
}

export function ReceiptTabs({ receipts, activeReceiptId, onSelect, onAdd, onRemove, onRename, appendTab }: Props) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingTabName, setEditingTabName] = useState('')
  const tabInputRef = useRef<HTMLInputElement>(null)

  const handleDoubleClick = (id: string, currentName: string) => {
    if (!onRename) return
    setEditingTabId(id)
    setEditingTabName(currentName)
    requestAnimationFrame(() => tabInputRef.current?.select())
  }

  const commitRename = () => {
    if (editingTabId && onRename) onRename(editingTabId, editingTabName)
    setEditingTabId(null)
  }

  return (
    <div className="flex items-center gap-3 mb-8">
      {/* Segmented pill */}
      <div className="flex items-center bg-surface-container-low rounded-xl p-1 gap-0.5 overflow-x-auto">
        {receipts.map((receipt) => {
          const isActive = receipt.id === activeReceiptId
          return (
            <div
              key={receipt.id}
              onClick={() => onSelect(receipt.id)}
              onDoubleClick={() => handleDoubleClick(receipt.id, receipt.name)}
              className={cn(
                'group relative flex items-center gap-1.5 px-4 py-1.5 rounded-lg cursor-pointer select-none transition-all',
                isActive
                  ? 'bg-white shadow-sm text-on-surface'
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
                    if (e.key === 'Enter') commitRename()
                    if (e.key === 'Escape') setEditingTabId(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-transparent outline-none w-24 font-bold text-sm"
                  autoFocus
                />
              ) : (
                <>
                  <span className={cn('text-sm whitespace-nowrap', isActive ? 'font-bold' : 'font-semibold')}>
                    {receipt.name}
                  </span>
                  {isActive && onRename && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDoubleClick(receipt.id, receipt.name) }}
                      aria-label="Rename receipt"
                      className="flex-shrink-0 flex items-center opacity-40 hover:opacity-100 transition-opacity"
                    >
                      <span className="material-symbols-outlined !text-sm leading-none">edit</span>
                    </button>
                  )}
                </>
              )}
              {receipts.length > 1 && onRemove && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemove(receipt.id) }}
                  aria-label={`Remove ${receipt.name}`}
                  className="flex-shrink-0 h-3.5 w-3.5 flex opacity-40 hover:opacity-100 transition-opacity"
                >
                  <span className="material-symbols-outlined leading-none !text-base cursor-pointer">close</span>
                </button>
              )}
            </div>
          )
        })}

        {appendTab && (
          <div
            onClick={appendTab.onClick}
            className={cn(
              'flex items-center gap-2 px-4 py-1.5 rounded-lg cursor-pointer select-none transition-all',
              appendTab.isActive
                ? 'bg-white shadow-sm text-on-surface font-bold'
                : 'text-on-surface-variant hover:text-on-surface font-semibold',
            )}
          >
            <span className="material-symbols-outlined text-sm">{appendTab.icon}</span>
            <span className="text-sm whitespace-nowrap">{appendTab.label}</span>
          </div>
        )}
      </div>

      {/* Add receipt — outside the pill */}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-all whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          <span className="font-semibold text-sm">Add</span>
        </button>
      )}
    </div>
  )
}
