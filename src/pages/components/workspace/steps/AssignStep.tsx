import { useMemo } from 'react';
import { formatCurrencyFromCents, parseCurrencyToCents } from '@shared/logic/core/money';
import { isItemAssigned } from '@pages/logic/wizardValidation';
import {
  togglePersonInAssignment,
  selectAllPeople,
  selectNone,
} from '@shared/logic/assignment/assignActions';
import type { EditableItem, Person, Receipt } from '@shared/types';
import type { ItemsSubPhase } from '@pages/types';
import { PersonAvatar } from '@pages/components/workspace/shared/PersonAvatar';
import { ReceiptTabs } from '@pages/components/workspace/shared/ReceiptTabs';
import { ReceiptNameField } from '@pages/components/workspace/shared/ReceiptNameField';
import { BASE_CURRENCY } from '@shared/constants';
import { cn } from '@shared/utils/cn';

type Props = {
  receipts: Receipt[];
  activeReceiptId: string;
  onSelectReceipt: (id: string) => void;
  onRenameReceipt: (id: string, name: string) => void;
  items: EditableItem[];
  people: Person[];
  itemsSubPhase: ItemsSubPhase;
  activeItemIndex: number;
  onActiveItemIndexChange: (index: number) => void;
  onItemsSubPhaseChange: (phase: ItemsSubPhase) => void;
  onUpdateItem: (id: string, updater: (current: EditableItem) => EditableItem) => void;
};

export function AssignStep({
  receipts,
  activeReceiptId,
  onSelectReceipt,
  onRenameReceipt,
  items,
  people,
  itemsSubPhase,
  activeItemIndex,
  onActiveItemIndexChange,
  onItemsSubPhaseChange,
  onUpdateItem,
}: Props) {
  const validPeopleSet = useMemo(() => new Set(people.map((p) => p.id)), [people]);
  const activeReceipt = receipts.find((r) => r.id === activeReceiptId);
  const activeCurrency = activeReceipt?.currency ?? BASE_CURRENCY;

  return (
    <div>
      {/* Header — desktop */}
      <div className="mb-6 hidden md:block">
        <h1 className="text-4xl md:text-5xl font-extrabold font-headline text-on-surface tracking-tight mb-2">
          Assign Items
        </h1>
        <p className="text-on-surface-variant text-lg">
          Assign each item to the people who ordered it.
        </p>
      </div>

      {/* Header — mobile */}
      <div className="mb-4 md:hidden">
        <h1 className="text-xl font-extrabold font-headline text-on-surface tracking-tight">
          Assign Items
        </h1>
        <p className="text-on-surface-variant text-xs mt-0.5">
          Assign each item to the people who ordered it.
        </p>
      </div>

      <ReceiptTabs
        receipts={receipts}
        activeReceiptId={itemsSubPhase === 'review' ? '' : activeReceiptId}
        onSelect={(id) => {
          onSelectReceipt(id);
          onItemsSubPhaseChange('assign');
        }}
        onRename={onRenameReceipt}
        appendTab={{
          icon: 'assignment_turned_in',
          label: 'Review All',
          isActive: itemsSubPhase === 'review',
          onClick: () => onItemsSubPhaseChange('review'),
        }}
      />

      {itemsSubPhase === 'assign' && activeReceipt && (
        <div className="flex items-center gap-2 mt-3 mb-1 px-1">
          <span className="material-symbols-outlined text-sm text-outline">receipt_long</span>
          <ReceiptNameField
            key={activeReceiptId}
            name={activeReceipt.name}
            onRename={(name) => onRenameReceipt(activeReceiptId, name)}
          />
        </div>
      )}

      {itemsSubPhase === 'assign' ? (
        <AssignPhase
          items={items}
          people={people}
          validPeopleSet={validPeopleSet}
          activeItemIndex={activeItemIndex}
          onActiveItemIndexChange={onActiveItemIndexChange}
          onUpdateItem={onUpdateItem}
          currency={activeCurrency}
        />
      ) : (
        <ReviewPhase
          items={items}
          people={people}
          onEditItem={(index) => {
            onActiveItemIndexChange(index);
            onItemsSubPhaseChange('assign');
          }}
        />
      )}
    </div>
  );
}

// ── Assign sub-phase ──────────────────────────────────────────────────────────

type AssignPhaseProps = {
  items: EditableItem[];
  people: Person[];
  validPeopleSet: Set<string>;
  activeItemIndex: number;
  onActiveItemIndexChange: (index: number) => void;
  onUpdateItem: (id: string, updater: (current: EditableItem) => EditableItem) => void;
  currency: string;
};

function AssignPhase({
  items,
  people,
  validPeopleSet,
  activeItemIndex,
  onActiveItemIndexChange,
  onUpdateItem,
  currency,
}: AssignPhaseProps) {
  const activeItem = items[activeItemIndex] ?? null;
  const isAssigned = activeItem ? isItemAssigned(activeItem, validPeopleSet) : false;

  const handleTogglePerson = (personId: string, checked: boolean) => {
    if (!activeItem) return;
    const updated = togglePersonInAssignment(personId, checked, activeItem);
    onUpdateItem(activeItem.id, () => updated);
  };

  const handleSelectAll = () => {
    if (!activeItem) return;
    onUpdateItem(activeItem.id, () => selectAllPeople(people, activeItem));
  };

  const handleSelectNone = () => {
    if (!activeItem) return;
    onUpdateItem(activeItem.id, () => selectNone(activeItem));
  };

  if (!activeItem) {
    return (
      <p className="text-sm text-on-surface-variant text-center py-12">No items available yet.</p>
    );
  }

  const priceCents = parseCurrencyToCents(activeItem.amountInput);

  return (
    <div className="space-y-5">
      {/* Counter + nav arrows */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Assigning Items
          </p>
          <p
            data-testid="assign-item-counter"
            className="text-2xl font-extrabold text-on-surface font-headline"
          >
            Item {activeItemIndex + 1} of {items.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="assign-prev-item-btn"
            onClick={() => onActiveItemIndexChange(Math.max(0, activeItemIndex - 1))}
            disabled={activeItemIndex === 0}
            className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high transition-colors disabled:opacity-30"
          >
            <span className="material-symbols-outlined text-on-surface">chevron_left</span>
          </button>
          <button
            type="button"
            data-testid="assign-next-item-btn"
            onClick={() => onActiveItemIndexChange(Math.min(items.length - 1, activeItemIndex + 1))}
            disabled={activeItemIndex >= items.length - 1}
            className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high transition-colors disabled:opacity-30"
          >
            <span className="material-symbols-outlined text-on-surface">chevron_right</span>
          </button>
        </div>
      </div>

      {/* Item card */}
      <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-[0_8px_24px_rgba(25,28,29,0.06)]">
        <div className="flex justify-between items-start mb-1">
          <h2 className="text-2xl md:text-3xl font-bold font-headline text-on-surface">
            {activeItem.name || 'Untitled item'}
          </h2>
          {isAssigned ? (
            <div
              data-testid="assign-item-status"
              data-assigned="true"
              className="flex items-center gap-1.5 text-secondary font-bold text-sm flex-shrink-0 ml-3"
            >
              <span
                className="material-symbols-outlined text-sm"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
              Assigned
            </div>
          ) : (
            <div
              data-testid="assign-item-status"
              data-assigned="false"
              className="flex items-center gap-1.5 text-error font-bold text-sm flex-shrink-0 ml-3"
            >
              <span
                className="material-symbols-outlined text-sm"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                cancel
              </span>
              Select one or more people
            </div>
          )}
        </div>
        <div className="text-3xl md:text-4xl font-extrabold font-headline text-primary">
          {priceCents !== null ? formatCurrencyFromCents(priceCents, currency) : '—'}
        </div>
      </div>

      {/* Who's sharing header */}
      <div className="flex justify-between items-center">
        <span className="text-base font-semibold text-on-surface">Who's sharing?</span>
        <div className="flex gap-3">
          <button
            type="button"
            data-testid="assign-select-all-btn"
            onClick={handleSelectAll}
            disabled={people.length === 0}
            className="text-primary font-bold text-sm hover:opacity-70 transition-opacity disabled:opacity-40"
          >
            Select all
          </button>
          <button
            type="button"
            data-testid="assign-select-none-btn"
            onClick={handleSelectNone}
            disabled={people.length === 0}
            className="text-on-surface-variant font-semibold text-sm hover:opacity-70 transition-opacity disabled:opacity-40"
          >
            None
          </button>
        </div>
      </div>

      {/* Person toggle buttons */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {people.map((person, index) => {
          const isSelected = activeItem.assignment.personIds.includes(person.id);
          const assignedCount = activeItem.assignment.personIds.length;
          const shareAmount =
            isSelected && priceCents !== null && assignedCount > 0
              ? Math.round(priceCents / assignedCount)
              : 0;
          return (
            <button
              key={person.id}
              type="button"
              data-testid={`assign-person-btn-${person.id}`}
              aria-pressed={isSelected}
              onClick={() => handleTogglePerson(person.id, !isSelected)}
              onDoubleClick={() => {
                onUpdateItem(activeItem.id, (current) => ({
                  ...current,
                  assignment: { mode: 'equal', personId: '', personIds: [person.id] },
                }));
              }}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left',
                isSelected
                  ? 'bg-surface-container-lowest border-2 border-secondary shadow-[0_4px_14px_rgba(27,109,36,0.2)]'
                  : 'bg-surface-container-low border-2 border-transparent hover:bg-surface-container',
              )}
            >
              <PersonAvatar name={person.name} colorIndex={index} />
              <div className="flex-1 min-w-0">
                <span className="block font-bold text-on-surface text-sm">{person.name}</span>
                <span
                  className={cn(
                    'text-sm font-semibold',
                    isSelected ? 'text-secondary' : 'text-on-surface-variant',
                  )}
                >
                  {formatCurrencyFromCents(shareAmount, currency)}
                </span>
              </div>
              {isSelected && (
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-secondary flex items-center justify-center">
                  <span
                    className="material-symbols-outlined !text-xs text-on-secondary leading-none"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Double-tap hint */}
      <div className="flex items-center gap-1.5 text-on-surface-variant text-xs italic">
        <span className="material-symbols-outlined text-sm">info</span>
        Double-tap a person to assign only them.
      </div>
    </div>
  );
}

// ── Review sub-phase ──────────────────────────────────────────────────────────

type ReviewPhaseProps = {
  items: EditableItem[];
  people: Person[];
  onEditItem: (index: number) => void;
};

function ReviewPhase({ items, people, onEditItem }: ReviewPhaseProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold font-headline text-on-surface">Review Assignments</h2>
        <span className="text-sm text-on-surface-variant">
          {items.length} item{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => {
          const selectedPeople = people
            .filter((p) => item.assignment.personIds.includes(p.id))
            .map((p) => p.name);
          const isAssigned = selectedPeople.length > 0;
          const priceCents = parseCurrencyToCents(item.amountInput);

          return (
            <article
              key={item.id}
              className={cn(
                'flex items-center justify-between gap-3 rounded-xl border p-4 transition-all',
                isAssigned
                  ? 'bg-surface-container-lowest border-surface-container-highest hover:border-outline-variant/30'
                  : 'bg-surface-container-lowest border-error/50 hover:border-error',
              )}
            >
              <div className="space-y-1 flex-1 min-w-0">
                <p className="font-bold text-on-surface truncate">
                  {item.name || `Item ${index + 1}`}
                </p>
                {priceCents !== null && (
                  <span className="block text-sm font-bold text-primary font-headline">
                    {formatCurrencyFromCents(priceCents)}
                  </span>
                )}
                <span
                  className={cn(
                    'block text-sm',
                    isAssigned ? 'text-on-surface-variant' : 'text-error',
                  )}
                >
                  {isAssigned ? `Split: ${selectedPeople.join(', ')}` : 'No people selected'}
                </span>
              </div>
              <button
                type="button"
                data-testid="wizard-edit-btn"
                onClick={() => onEditItem(index)}
                className="shrink-0 flex items-center gap-1 border border-outline-variant text-primary rounded-xl px-3 py-2 text-sm font-semibold hover:border-primary hover:bg-primary/5 transition-all"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                Edit
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
