import { useMemo } from 'react';
import { formatCurrencyFromCents, parseCurrencyToCents } from '@shared/logic/core/money';
import { getPersonColor } from '@shared/utils/personColors';
import type { EditableItem, Person } from '@shared/types';
import { isSimpleItemAssigned } from '@pages/logic/wizardValidation';

type Props = {
  items: EditableItem[];
  people: Person[];
  activeItemIndex: number;
  onUpdateItem: (id: string, updater: (current: EditableItem) => EditableItem) => void;
  onPrevItem: () => void;
  onNextItem: () => void;
  onGoToReview: () => void;
};

export function ItemsStepAssignPhase({
  items,
  people,
  activeItemIndex,
  onUpdateItem,
  onPrevItem,
  onNextItem,
  onGoToReview,
}: Props) {
  const activeItem = items[activeItemIndex] ?? null;
  const validPeopleSet = useMemo(() => new Set(people.map((p) => p.id)), [people]);
  const activeItemAssigned = activeItem ? isSimpleItemAssigned(activeItem, validPeopleSet) : false;

  const handleTogglePerson = (personId: string, checked: boolean) => {
    if (!activeItem) return;
    onUpdateItem(activeItem.id, (currentItem) => {
      const currentIds = new Set(currentItem.assignment.personIds);
      if (checked) currentIds.add(personId);
      else currentIds.delete(personId);
      return {
        ...currentItem,
        assignment: { mode: 'equal', personId: '', personIds: Array.from(currentIds) },
      };
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-white/8 bg-slate-800/40 p-4">
      {activeItem ? (
        <>
          <p className="text-xs font-medium text-slate-500">
            Item {activeItemIndex + 1} of {items.length}
          </p>

          {/* Active item card */}
          <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3">
            <p className="font-semibold text-slate-100">{activeItem.name || 'Untitled item'}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              {(() => {
                const cents = parseCurrencyToCents(activeItem.amountInput);
                return cents === null ? 'Invalid amount' : formatCurrencyFromCents(cents);
              })()}
            </p>
          </div>

          <p className="text-xs text-slate-400">Split equally among:</p>

          {/* Pill toggle buttons */}
          <div className="flex flex-wrap gap-2">
            {people.map((person, index) => {
              const isSelected = activeItem.assignment.personIds.includes(person.id);
              const color = getPersonColor(index);
              return (
                <button
                  key={person.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleTogglePerson(person.id, !isSelected)}
                  onDoubleClick={() => {
                    onUpdateItem(activeItem.id, (currentItem) => ({
                      ...currentItem,
                      assignment: { mode: 'equal', personId: '', personIds: [person.id] },
                    }));
                  }}
                  className={[
                    'rounded-full px-4 py-2.5 text-sm font-semibold transition active:scale-95',
                    isSelected
                      ? `${color.bg} ${color.text} shadow-sm`
                      : 'border border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-500 hover:text-slate-200',
                  ].join(' ')}
                >
                  {person.name}
                </button>
              );
            })}
          </div>

          {/* Select all / none */}
          <div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  onUpdateItem(activeItem.id, (currentItem) => ({
                    ...currentItem,
                    assignment: {
                      mode: 'equal',
                      personId: '',
                      personIds: people.map((p) => p.id),
                    },
                  }));
                }}
                disabled={people.length === 0}
                className="text-xs text-slate-500 underline underline-offset-2 transition hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateItem(activeItem.id, (currentItem) => ({
                    ...currentItem,
                    assignment: { mode: 'equal', personId: '', personIds: [] },
                  }));
                }}
                disabled={people.length === 0}
                className="text-xs text-slate-500 underline underline-offset-2 transition hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Select none
              </button>
            </div>
            <span className="text-xs text-slate-600">Double-click to assign only that person</span>
          </div>

          <p className={activeItemAssigned ? 'text-xs text-emerald-400' : 'text-xs text-amber-400'}>
            {activeItemAssigned ? 'Item assigned ✓' : 'Select at least one person for this item.'}
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onPrevItem}
              disabled={activeItemIndex === 0}
              className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Previous
            </button>
            <button
              type="button"
              onClick={onNextItem}
              disabled={activeItemIndex >= items.length - 1}
              className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </button>
            <button
              type="button"
              onClick={onGoToReview}
              className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-300 transition hover:bg-sky-500/15"
            >
              Review Assignments
            </button>
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-500">No items available yet.</p>
      )}
    </div>
  );
}
