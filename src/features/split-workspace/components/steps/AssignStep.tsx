import { useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import {
  applyAssignmentCommand,
  resolveAssignmentInteraction,
} from '@features/split-workspace/logic/assignmentInteraction';
import type {
  AssignmentActiveItem,
  AssignmentCommand,
  AssignmentAssignModel,
  AssignmentPersonRow,
  AssignmentReviewRow,
} from '@features/split-workspace/logic/assignmentInteraction';
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
  const activeReceipt = receipts.find((r) => r.id === activeReceiptId);
  const activeCurrency = activeReceipt?.currency ?? BASE_CURRENCY;
  const interaction = useMemo(
    () =>
      resolveAssignmentInteraction({
        items,
        people,
        phase: itemsSubPhase,
        activeItemIndex,
        currency: activeCurrency,
      }),
    [activeCurrency, activeItemIndex, items, itemsSubPhase, people],
  );

  const applyCommand = (command: AssignmentCommand) => {
    const result = applyAssignmentCommand({
      command,
      item: items[activeItemIndex] ?? null,
      people,
    });

    if (result.type === 'item-updated') {
      updateItem(result.itemId, () => result.item);
    }
  };

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
          model={interaction.assign}
          activeItemIndex={activeItemIndex}
          itemCount={items.length}
          onActiveItemIndexChange={onActiveItemIndexChange}
          onItemsSubPhaseChange={onItemsSubPhaseChange}
          onCommand={applyCommand}
          onSplitUnassignedItemsEqually={splitUnassignedItemsEquallyForActiveReceipt}
        />
      ) : (
        <ReviewPhase
          rows={interaction.review.rows}
          itemCount={interaction.review.itemCount}
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
  model: AssignmentAssignModel;
  activeItemIndex: number;
  itemCount: number;
  onActiveItemIndexChange: (index: number) => void;
  onItemsSubPhaseChange: (phase: ItemsSubPhase) => void;
  onCommand: (command: AssignmentCommand) => void;
  onSplitUnassignedItemsEqually: () => void;
};

function AssignPhase({
  model,
  activeItemIndex,
  itemCount,
  onActiveItemIndexChange,
  onItemsSubPhaseChange,
  onCommand,
  onSplitUnassignedItemsEqually,
}: AssignPhaseProps) {
  const { activeItem } = model;
  const handleSplitRest = () => {
    if (!model.canSplitUnassigned) return;
    onSplitUnassignedItemsEqually();
    onActiveItemIndexChange(0);
    onItemsSubPhaseChange('review');
  };

  if (!activeItem) {
    return (
      <p className="py-12 text-center text-sm text-on-surface-variant">No items available yet.</p>
    );
  }

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
            {model.activeItemPositionLabel}
          </p>
        </div>
        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            type="button"
            data-testid="assign-split-rest-btn"
            onClick={handleSplitRest}
            disabled={!model.canSplitUnassigned}
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
            onClick={() => onActiveItemIndexChange(Math.min(itemCount - 1, activeItemIndex + 1))}
            disabled={activeItemIndex >= itemCount - 1}
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
            {activeItem.title}
          </h2>
          {activeItem.isAssigned ? (
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
          {activeItem.priceLabel}
        </div>
      </div>

      {/* Who's sharing header */}
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold text-on-surface">Who's sharing?</span>
        <div className="flex gap-3">
          <button
            type="button"
            data-testid="assign-select-all-btn"
            onClick={() => onCommand({ type: 'select-all' })}
            disabled={model.people.length === 0}
            className="text-sm font-bold text-primary transition-opacity hover:opacity-70 disabled:opacity-40"
          >
            Select all
          </button>
          <button
            type="button"
            data-testid="assign-select-none-btn"
            onClick={() => onCommand({ type: 'select-none' })}
            disabled={model.people.length === 0}
            className="text-sm font-semibold text-on-surface-variant transition-opacity hover:opacity-70 disabled:opacity-40"
          >
            None
          </button>
        </div>
      </div>

      {/* Person toggle buttons */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {model.people.map((person) => {
          return (
            <button
              key={person.id}
              type="button"
              data-testid={`assign-person-btn-${person.id}`}
              aria-pressed={person.isSelected}
              onClick={() =>
                onCommand({
                  type: 'toggle-person',
                  personId: person.id,
                  checked: !person.isSelected,
                })
              }
              onDoubleClick={() => {
                onCommand({ type: 'assign-only', personId: person.id });
              }}
              className={cn(
                'flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all',
                person.isSelected
                  ? 'border-2 border-secondary bg-surface-container-lowest shadow-[0_4px_14px_rgba(27,109,36,0.2)]'
                  : 'border-2 border-transparent bg-surface-container-low hover:bg-surface-container',
              )}
            >
              <PersonAvatar name={person.name} colorIndex={person.colorIndex} />
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-on-surface">{person.name}</span>
                <span
                  className={cn(
                    'text-sm font-semibold',
                    person.isSelected ? 'text-secondary' : 'text-on-surface-variant',
                  )}
                >
                  {person.shareLabel}
                </span>
              </div>
              {person.isSelected && (
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
              if (activeItem.splitMode === 'shares') {
                onCommand({ type: 'set-split-mode', mode: 'equal' });
              }
            }}
            disabled={!activeItem.canUseShares}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
              activeItem.splitMode === 'equal'
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
              if (activeItem.splitMode === 'equal') {
                onCommand({ type: 'set-split-mode', mode: 'shares' });
              }
            }}
            disabled={!activeItem.canUseShares}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
              activeItem.splitMode === 'shares'
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
      <ShareWeightControls activeItem={activeItem} people={model.people} onCommand={onCommand} />

      {/* Double-tap hint */}
      <div className="flex items-center gap-1.5 text-xs text-on-surface-variant italic">
        <span className="material-symbols-outlined text-sm">info</span>
        Double-tap a person to assign only them.
      </div>
    </div>
  );
}

type ShareWeightControlsProps = {
  activeItem: AssignmentActiveItem;
  people: AssignmentPersonRow[];
  onCommand: (command: AssignmentCommand) => void;
};

function ShareWeightControls({ activeItem, people, onCommand }: ShareWeightControlsProps) {
  if (activeItem.splitMode !== 'shares' || !activeItem.canUseShares) {
    return null;
  }

  const selectedPeople = activeItem.selectedPersonIds
    .map((personId) => people.find((person) => person.id === personId))
    .filter((person): person is AssignmentPersonRow => person !== undefined);

  return (
    <div
      data-testid="assign-weight-controls"
      className="space-y-3 rounded-xl bg-surface-container-low p-4"
    >
      <p className="text-xs font-bold tracking-widest text-on-surface-variant uppercase">
        Share weights
      </p>
      {selectedPeople.map((person) => {
        return (
          <div key={person.id} className="flex items-center justify-between gap-3">
            <span className="flex-1 truncate text-sm font-semibold text-on-surface">
              {person.name}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid={`assign-weight-decrement-${person.id}`}
                onClick={() => onCommand({ type: 'adjust-weight', personId: person.id, delta: -1 })}
                disabled={!person.canDecrementWeight}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container transition-colors hover:bg-surface-container-high disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-sm text-on-surface">remove</span>
              </button>
              <input
                type="text"
                inputMode="numeric"
                data-testid={`assign-weight-value-${person.id}`}
                value={person.weight}
                onChange={(event) => {
                  const parsed = parseInt(event.target.value, 10);
                  if (!isNaN(parsed)) {
                    onCommand({ type: 'set-weight', personId: person.id, value: parsed });
                  }
                }}
                onBlur={(event) => {
                  const parsed = parseInt(event.target.value, 10);
                  onCommand({
                    type: 'set-weight',
                    personId: person.id,
                    value: isNaN(parsed) ? 1 : parsed,
                  });
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
                }}
                className="w-10 rounded-md border border-outline-variant/40 bg-surface text-center text-sm font-bold text-on-surface focus:ring-1 focus:ring-primary focus:outline-none"
              />
              <button
                type="button"
                data-testid={`assign-weight-increment-${person.id}`}
                onClick={() => onCommand({ type: 'adjust-weight', personId: person.id, delta: 1 })}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container transition-colors hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-sm text-on-surface">add</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Review sub-phase ──────────────────────────────────────────────────────────

type ReviewPhaseProps = {
  rows: AssignmentReviewRow[];
  itemCount: number;
  onEditItem: (index: number) => void;
};

function ReviewPhase({ rows, itemCount, onEditItem }: ReviewPhaseProps) {
  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-headline text-2xl font-bold text-on-surface">Review Assignments</h2>
        <span className="text-sm text-on-surface-variant">
          {itemCount} item{itemCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => {
          return (
            <article
              key={row.itemId}
              className={cn(
                'flex items-center justify-between gap-3 rounded-xl border p-4 transition-all',
                row.isAssigned
                  ? 'border-surface-container-highest bg-surface-container-lowest hover:border-outline-variant/30'
                  : 'border-error/50 bg-surface-container-lowest hover:border-error',
              )}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate font-bold text-on-surface">
                  {row.title || `Item ${index + 1}`}
                </p>
                {row.priceLabel !== null && (
                  <span className="font-headline block text-sm font-bold text-primary">
                    {row.priceLabel}
                  </span>
                )}
                <span
                  className={cn(
                    'block text-sm',
                    row.isAssigned ? 'text-on-surface-variant' : 'text-error',
                  )}
                >
                  {row.splitLabel}
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
