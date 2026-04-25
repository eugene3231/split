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
    splitUnassignedItemsEquallyForActiveReceipt,
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
        splitUnassignedItemsEquallyForActiveReceipt:
          state.splitUnassignedItemsEquallyForActiveReceipt,
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
          onItemsSubPhaseChange={onItemsSubPhaseChange}
          onUpdateItem={updateItem}
          onSplitUnassignedItemsEqually={splitUnassignedItemsEquallyForActiveReceipt}
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
  onItemsSubPhaseChange: (phase: ItemsSubPhase) => void;
  onUpdateItem: (id: string, updater: (current: EditableItem) => EditableItem) => void;
  onSplitUnassignedItemsEqually: () => void;
  currency: string;
};

function AssignPhase({
  items,
  people,
  validPeopleSet,
  activeItemIndex,
  onActiveItemIndexChange,
  onItemsSubPhaseChange,
  onUpdateItem,
  onSplitUnassignedItemsEqually,
  currency,
}: AssignPhaseProps) {
  const activeItem = items[activeItemIndex] ?? null;
  const isAssigned = activeItem ? isItemAssigned(activeItem, validPeopleSet) : false;
  const unassignedItemCount = items.filter((item) => !isItemAssigned(item, validPeopleSet)).length;
  const canSplitRest = people.length > 0 && unassignedItemCount > 0;

  const selectedIds = activeItem?.assignment.personIds ?? [];
  const weights = activeItem?.assignment.weights;
  const unequalMode = Boolean(weights);
  const totalWeight = selectedIds.reduce((sum, id) => sum + (weights?.[id] ?? 1), 0);
  const canToggleUnequal = selectedIds.length >= 2;

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

  const handleSplitRest = () => {
    if (!canSplitRest) return;
    onSplitUnassignedItemsEqually();
    onActiveItemIndexChange(0);
    onItemsSubPhaseChange('review');
  };

  const handleUnequalToggle = () => {
    if (!activeItem || !canToggleUnequal) return;
    onUpdateItem(activeItem.id, (current) => ({
      ...current,
      assignment: {
        ...current.assignment,
        weights: current.assignment.weights
          ? undefined
          : Object.fromEntries(current.assignment.personIds.map((id) => [id, 1])),
      },
    }));
  };

  const handleWeightChange = (personId: string, delta: number) => {
    if (!activeItem) return;
    const current = activeItem.assignment.weights?.[personId] ?? 1;
    const next = Math.max(1, current + delta);
    const updatedWeights: Record<string, number> = {};
    for (const id of selectedIds) {
      updatedWeights[id] = id === personId ? next : (weights?.[id] ?? 1);
    }
    onUpdateItem(activeItem.id, (item) => ({
      ...item,
      assignment: { ...item.assignment, weights: updatedWeights },
    }));
  };

  const handleWeightSet = (personId: string, value: number) => {
    if (!activeItem) return;
    const clamped = Math.max(1, Math.round(value));
    const updatedWeights: Record<string, number> = {};
    for (const id of selectedIds) {
      updatedWeights[id] = id === personId ? clamped : (weights?.[id] ?? 1);
    }
    onUpdateItem(activeItem.id, (item) => ({
      ...item,
      assignment: { ...item.assignment, weights: updatedWeights },
    }));
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
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            type="button"
            data-testid="assign-split-rest-btn"
            onClick={handleSplitRest}
            disabled={!canSplitRest}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-bold whitespace-nowrap text-on-primary transition-all hover:opacity-90 disabled:bg-surface-container-high disabled:text-on-surface-variant disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-base">group</span>
            Split unassigned
          </button>
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
          const isSelected = selectedIds.includes(person.id);
          const personWeight = weights?.[person.id] ?? 1;
          const shareAmount =
            isSelected && priceCents !== null && totalWeight > 0
              ? Math.round((priceCents * personWeight) / totalWeight)
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

      <div
        role="group"
        aria-label="Split"
        data-testid="assign-split-mode-toggle"
        className="space-y-2 rounded-xl bg-surface-container-low p-3"
      >
        <span className="block text-xs font-bold tracking-widest text-on-surface-variant uppercase">
          Split
        </span>
        <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-0.5">
          <button
            type="button"
            onClick={() => {
              if (unequalMode) handleUnequalToggle();
            }}
            disabled={!canToggleUnequal}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
              !unequalMode
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container',
            )}
          >
            <span className="material-symbols-outlined text-sm" aria-hidden="true">
              drag_handle
            </span>
            Equally
          </button>
          <button
            type="button"
            onClick={() => {
              if (!unequalMode) handleUnequalToggle();
            }}
            disabled={!canToggleUnequal}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
              unequalMode
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container',
            )}
          >
            <span className="material-symbols-outlined text-sm" aria-hidden="true">
              pie_chart
            </span>
            By shares
          </button>
        </div>
      </div>

      {/* Weight steppers (shown in unequal mode) */}
      {unequalMode && canToggleUnequal && (
        <div
          data-testid="assign-weight-controls"
          className="space-y-3 rounded-xl bg-surface-container-low p-4"
        >
          <p className="text-xs font-bold tracking-widest text-on-surface-variant uppercase">
            Share weights
          </p>
          {selectedIds.map((personId) => {
            const person = people.find((p) => p.id === personId);
            if (!person) return null;
            const w = weights?.[personId] ?? 1;
            return (
              <div key={personId} className="flex items-center justify-between gap-3">
                <span className="flex-1 truncate text-sm font-semibold text-on-surface">
                  {person.name}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid={`assign-weight-decrement-${personId}`}
                    onClick={() => handleWeightChange(personId, -1)}
                    disabled={w <= 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container transition-colors hover:bg-surface-container-high disabled:opacity-30"
                  >
                    <span className="material-symbols-outlined text-sm text-on-surface">
                      remove
                    </span>
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    data-testid={`assign-weight-value-${personId}`}
                    value={w}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value, 10);
                      if (!isNaN(parsed)) handleWeightSet(personId, parsed);
                    }}
                    onBlur={(e) => {
                      const parsed = parseInt(e.target.value, 10);
                      handleWeightSet(personId, isNaN(parsed) ? 1 : parsed);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                    className="w-10 rounded-md border border-outline-variant/40 bg-surface text-center text-sm font-bold text-on-surface focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    data-testid={`assign-weight-increment-${personId}`}
                    onClick={() => handleWeightChange(personId, 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container transition-colors hover:bg-surface-container-high"
                  >
                    <span className="material-symbols-outlined text-sm text-on-surface">add</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
          const selectedPeople = people.filter((person) =>
            item.assignment.personIds.includes(person.id),
          );
          const isAssigned = selectedPeople.length > 0;
          const priceCents = parseCurrencyToCents(item.amountInput);

          const itemWeights = item.assignment.weights;
          const hasUnequalWeights =
            itemWeights !== undefined &&
            item.assignment.personIds.length >= 2 &&
            item.assignment.personIds.some((id) => (itemWeights[id] ?? 1) !== 1);
          const splitLabel = hasUnequalWeights
            ? `Split: ${selectedPeople
                .map((person) => {
                  const weight = itemWeights?.[person.id] ?? 1;
                  return `${person.name} ×${weight}`;
                })
                .join(', ')}`
            : `Split: ${selectedPeople.map((person) => person.name).join(', ')}`;

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
                  {isAssigned ? splitLabel : 'No people selected'}
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
