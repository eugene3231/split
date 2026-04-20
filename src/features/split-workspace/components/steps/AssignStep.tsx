import { useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { formatCurrencyFromCents, parseCurrencyToCents } from '@shared/logic/core/money';
import { isItemAssigned } from '@features/split-workspace/logic/wizardValidation';
import {
  togglePersonInAssignment,
  selectAllPeople,
  selectNone,
} from '@features/split-workspace/logic/assignmentActions';
import type { EditableItem, Person } from '@shared/types';
import type { ItemsSubPhase } from '@features/split-workspace/types';
import { PersonAvatar } from '@features/split-workspace/components/shared/PersonAvatar';
import { ReceiptTabs } from '@features/split-workspace/components/shared/ReceiptTabs';
import { ReceiptNameField } from '@features/split-workspace/components/shared/ReceiptNameField';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { BASE_CURRENCY } from '@shared/constants';
import { cn } from '@shared/utils/cn';

type Props = {
  itemsSubPhase: ItemsSubPhase;
  activeItemIndex: number;
  onActiveItemIndexChange: (index: number) => void;
  onItemsSubPhaseChange: (phase: ItemsSubPhase) => void;
};

export function AssignStep({
  itemsSubPhase,
  activeItemIndex,
  onActiveItemIndexChange,
  onItemsSubPhaseChange,
}: Props) {
  const {
    receipts,
    activeReceiptId,
    items,
    people,
    setActiveReceiptId,
    renameReceipt,
    updateItem,
  } = useReceiptStore(
    useShallow((state) => {
      const activeReceipt =
        state.receipts.find((receipt) => receipt.id === state.activeReceiptId) ?? state.receipts[0];
      return {
        receipts: state.receipts,
        activeReceiptId: state.activeReceiptId,
        items: activeReceipt?.items ?? [],
        people: state.people,
        setActiveReceiptId: state.setActiveReceiptId,
        renameReceipt: state.renameReceipt,
        updateItem: state.updateItem,
      };
    }),
  );
  const validPeopleSet = useMemo(() => new Set(people.map((p) => p.id)), [people]);
  const activeReceipt = receipts.find((r) => r.id === activeReceiptId);
  const activeCurrency = activeReceipt?.currency ?? BASE_CURRENCY;

  return (
    <div>
      {/* Header — desktop */}
      <div className="mb-6 hidden md:block">
        <h1 className="font-headline mb-2 text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">
          Assign Items
        </h1>
        <p className="text-lg text-on-surface-variant">
          Assign each item to the people who ordered it.
        </p>
      </div>

      {/* Header — mobile */}
      <div className="mb-4 md:hidden">
        <h1 className="font-headline text-xl font-extrabold tracking-tight text-on-surface">
          Assign Items
        </h1>
        <p className="mt-0.5 text-xs text-on-surface-variant">
          Assign each item to the people who ordered it.
        </p>
      </div>

      <ReceiptTabs
        receipts={receipts}
        activeReceiptId={itemsSubPhase === 'review' ? '' : activeReceiptId}
        onSelect={(id) => {
          setActiveReceiptId(id);
          onItemsSubPhaseChange('assign');
        }}
        onRename={renameReceipt}
        appendTab={{
          icon: 'assignment_turned_in',
          label: 'Review All',
          isActive: itemsSubPhase === 'review',
          onClick: () => onItemsSubPhaseChange('review'),
        }}
      />

      {itemsSubPhase === 'assign' && activeReceipt && (
        <div className="mt-3 mb-1 flex items-center gap-2 px-1">
          <span className="material-symbols-outlined text-sm text-outline">receipt_long</span>
          <ReceiptNameField
            key={activeReceiptId}
            name={activeReceipt.name}
            onRename={(name) => renameReceipt(activeReceiptId, name)}
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
          onUpdateItem={updateItem}
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
      <p className="py-12 text-center text-sm text-on-surface-variant">No items available yet.</p>
    );
  }

  const priceCents = parseCurrencyToCents(activeItem.amountInput);

  return (
    <div className="space-y-5">
      {/* Counter + nav arrows */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold tracking-widest text-on-surface-variant uppercase">
            Assigning Items
          </p>
          <p
            data-testid="assign-item-counter"
            className="font-headline text-2xl font-extrabold text-on-surface"
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
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container transition-colors hover:bg-surface-container-high disabled:opacity-30"
          >
            <span className="material-symbols-outlined text-on-surface">chevron_left</span>
          </button>
          <button
            type="button"
            data-testid="assign-next-item-btn"
            onClick={() => onActiveItemIndexChange(Math.min(items.length - 1, activeItemIndex + 1))}
            disabled={activeItemIndex >= items.length - 1}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container transition-colors hover:bg-surface-container-high disabled:opacity-30"
          >
            <span className="material-symbols-outlined text-on-surface">chevron_right</span>
          </button>
        </div>
      </div>

      {/* Item card */}
      <div className="rounded-2xl bg-surface-container-lowest p-5 shadow-[0_8px_24px_rgba(25,28,29,0.06)]">
        <div className="mb-1 flex items-start justify-between">
          <h2 className="font-headline text-2xl font-bold text-on-surface md:text-3xl">
            {activeItem.name || 'Untitled item'}
          </h2>
          {isAssigned ? (
            <div
              data-testid="assign-item-status"
              data-assigned="true"
              className="ml-3 flex flex-shrink-0 items-center gap-1.5 text-sm font-bold text-secondary"
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
              className="ml-3 flex flex-shrink-0 items-center gap-1.5 text-sm font-bold text-error"
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
        <div className="font-headline text-3xl font-extrabold text-primary md:text-4xl">
          {priceCents !== null ? formatCurrencyFromCents(priceCents, currency) : '—'}
        </div>
      </div>

      {/* Who's sharing header */}
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold text-on-surface">Who's sharing?</span>
        <div className="flex gap-3">
          <button
            type="button"
            data-testid="assign-select-all-btn"
            onClick={handleSelectAll}
            disabled={people.length === 0}
            className="text-sm font-bold text-primary transition-opacity hover:opacity-70 disabled:opacity-40"
          >
            Select all
          </button>
          <button
            type="button"
            data-testid="assign-select-none-btn"
            onClick={handleSelectNone}
            disabled={people.length === 0}
            className="text-sm font-semibold text-on-surface-variant transition-opacity hover:opacity-70 disabled:opacity-40"
          >
            None
          </button>
        </div>
      </div>

      {/* Person toggle buttons */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
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
                'flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all',
                isSelected
                  ? 'border-2 border-secondary bg-surface-container-lowest shadow-[0_4px_14px_rgba(27,109,36,0.2)]'
                  : 'border-2 border-transparent bg-surface-container-low hover:bg-surface-container',
              )}
            >
              <PersonAvatar name={person.name} colorIndex={index} />
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-on-surface">{person.name}</span>
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
                <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-secondary">
                  <span
                    className="material-symbols-outlined !text-xs leading-none text-on-secondary"
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
      <div className="flex items-center gap-1.5 text-xs text-on-surface-variant italic">
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
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-headline text-2xl font-bold text-on-surface">Review Assignments</h2>
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
                  ? 'border-surface-container-highest bg-surface-container-lowest hover:border-outline-variant/30'
                  : 'border-error/50 bg-surface-container-lowest hover:border-error',
              )}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate font-bold text-on-surface">
                  {item.name || `Item ${index + 1}`}
                </p>
                {priceCents !== null && (
                  <span className="font-headline block text-sm font-bold text-primary">
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
                className="flex shrink-0 items-center gap-1 rounded-xl border border-outline-variant px-3 py-2 text-sm font-semibold text-primary transition-all hover:border-primary hover:bg-primary/5"
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
