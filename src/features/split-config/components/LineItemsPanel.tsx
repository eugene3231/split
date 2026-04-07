import { useMemo } from 'react';
import type { ChargeState, EditableItem, Person } from '@shared/types';
import { LineItemCard } from '@features/split-config/components/LineItemCard';

type LineItemsPanelProps = {
  people: Person[];
  items: EditableItem[];
  onAddItem: () => void;
  onRemoveItem: (itemId: string) => void;
  onUpdateItem: (itemId: string, updater: (item: EditableItem) => EditableItem) => void;
  globalDiscount?: ChargeState;
};

export function LineItemsPanel({
  people,
  items,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  globalDiscount,
}: LineItemsPanelProps) {
  const peopleSet = useMemo(() => new Set(people.map((person) => person.id)), [people]);

  return (
    <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Line Items</h2>
        <button
          type="button"
          onClick={onAddItem}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold hover:border-slate-500"
        >
          + Add Item
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <LineItemCard
            key={item.id}
            item={item}
            itemIndex={index}
            people={people}
            peopleSet={peopleSet}
            onRemoveItem={onRemoveItem}
            onUpdateItem={onUpdateItem}
            globalDiscount={globalDiscount}
          />
        ))}
      </div>
    </section>
  );
}
