import type { ItemLeft } from '@features/split-workspace/logic/claim';
import { ConfirmDialog } from '@features/split-workspace/components/shared/ConfirmDialog';

interface Props {
  items: ItemLeft[];
  peopleCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export function SplitLeftoversDialog({ items, peopleCount, onCancel, onConfirm }: Props) {
  const showReceipt = new Set(items.map((item) => item.receiptName)).size > 1;

  return (
    <ConfirmDialog
      title={`Split ${items.length} ${items.length === 1 ? 'item' : 'items'} evenly?`}
      confirmLabel="Split evenly"
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <p>
        Nobody has claimed these yet, so they will be split evenly between all {peopleCount} people.
      </p>
      <ul
        data-testid="split-leftovers-list"
        className="mt-4 max-h-64 divide-y divide-surface-container-high overflow-y-auto rounded-xl border border-outline-variant"
      >
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-3 py-2.5">
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block font-semibold break-words text-on-surface">{item.name}</span>
              {(item.leftLabel || showReceipt) && (
                <span className="block text-xs">
                  {[showReceipt && item.receiptName, item.leftLabel && `Only the ${item.leftLabel}`]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              )}
            </span>
            <span className="shrink-0 tabular-nums">{item.priceLabel}</span>
          </li>
        ))}
      </ul>
    </ConfirmDialog>
  );
}
