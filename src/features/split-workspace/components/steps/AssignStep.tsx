import { useMemo, useState } from 'react';
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
import { getPersonColor } from '@shared/utils/personColors';
import { BASE_CURRENCY } from '@shared/constants';
import { cn } from '@shared/utils/cn';

const LARGE_GROUP_THRESHOLD = 7;

const ITEM_ACCENT_COLORS = [
  'oklch(0.88 0.16 95)', // yellow
  'oklch(0.78 0.16 145)', // green
  'oklch(0.78 0.16 65)', // orange
  'oklch(0.78 0.16 25)', // red
  'oklch(0.78 0.16 235)', // blue
];

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
          <span className="material-symbols-outlined text-sm text-ink2">receipt_long</span>
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
    const isSelected = selectedIds.includes(personId);
    const current = weights?.[personId] ?? (isSelected ? 1 : 0);
    const next = Math.max(0, current + delta);

    const newIds =
      next === 0
        ? selectedIds.filter((id) => id !== personId)
        : isSelected
          ? selectedIds
          : [...selectedIds, personId];

    const newWeights: Record<string, number> = {};
    for (const id of newIds) {
      newWeights[id] = id === personId ? next : (weights?.[id] ?? 1);
    }

    onUpdateItem(activeItem.id, (item) => ({
      ...item,
      assignment: { ...item.assignment, personIds: newIds, weights: newWeights },
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
    return <p className="py-12 text-center text-sm text-ink2">No items available yet.</p>;
  }

  const priceCents = parseCurrencyToCents(activeItem.amountInput);
  const isLargeGroup = people.length >= LARGE_GROUP_THRESHOLD;
  const itemAccentColor = ITEM_ACCENT_COLORS[activeItemIndex % ITEM_ACCENT_COLORS.length];

  const sharedProps = {
    activeItem,
    items,
    people,
    selectedIds,
    weights,
    unequalMode,
    canToggleUnequal,
    totalWeight,
    priceCents,
    currency,
    isAssigned,
    canSplitRest,
    activeItemIndex,
    itemAccentColor,
    unassignedItemCount,
    onTogglePerson: handleTogglePerson,
    onSelectAll: handleSelectAll,
    onSelectNone: handleSelectNone,
    onSplitRest: handleSplitRest,
    onUnequalToggle: handleUnequalToggle,
    onWeightChange: handleWeightChange,
    onWeightSet: handleWeightSet,
    onActiveItemIndexChange,
    onUpdateItem,
  };

  return isLargeGroup ? <AssignGridView {...sharedProps} /> : <AssignOrbitView {...sharedProps} />;
}

// ── Shared view props ──

type ViewProps = {
  activeItem: EditableItem;
  items: EditableItem[];
  people: Person[];
  selectedIds: string[];
  weights: Record<string, number> | undefined;
  unequalMode: boolean;
  canToggleUnequal: boolean;
  totalWeight: number;
  priceCents: number | null;
  currency: string;
  isAssigned: boolean;
  canSplitRest: boolean;
  activeItemIndex: number;
  itemAccentColor: string;
  unassignedItemCount: number;
  onTogglePerson: (id: string, checked: boolean) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onSplitRest: () => void;
  onUnequalToggle: () => void;
  onWeightChange: (id: string, delta: number) => void;
  onWeightSet: (id: string, value: number) => void;
  onActiveItemIndexChange: (index: number) => void;
  onUpdateItem: (id: string, updater: (current: EditableItem) => EditableItem) => void;
};

// ── Split mode toggle (shared) ──

function SplitModeToggle({
  unequalMode,
  canToggleUnequal,
  onUnequalToggle,
  equalLabel = 'Equal split',
}: {
  unequalMode: boolean;
  canToggleUnequal: boolean;
  onUnequalToggle: () => void;
  equalLabel?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Split"
      data-testid="assign-split-mode-toggle"
      className="flex rounded-full bg-cream p-1"
    >
      <button
        type="button"
        onClick={() => {
          if (unequalMode) onUnequalToggle();
        }}
        disabled={!canToggleUnequal}
        className={cn(
          'flex-1 rounded-full py-2 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60',
          !unequalMode ? 'bg-ink text-white shadow-sm' : 'text-ink2',
        )}
      >
        {equalLabel}
      </button>
      <button
        type="button"
        onClick={() => {
          if (!unequalMode) onUnequalToggle();
        }}
        disabled={!canToggleUnequal}
        className={cn(
          'flex-1 rounded-full py-2 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60',
          unequalMode ? 'bg-ink text-white shadow-sm' : 'text-ink2',
        )}
      >
        By shares
      </button>
    </div>
  );
}

// ── Weight steppers (shared) ──

function WeightControls({
  selectedIds,
  people,
  weights,
  onWeightChange,
  onWeightSet,
}: {
  selectedIds: string[];
  people: Person[];
  weights: Record<string, number> | undefined;
  onWeightChange: (id: string, delta: number) => void;
  onWeightSet: (id: string, value: number) => void;
}) {
  return (
    <div data-testid="assign-weight-controls" className="space-y-2">
      {people.map((person) => {
        const personIndex = people.findIndex((p) => p.id === person.id);
        const isSelected = selectedIds.includes(person.id);
        const share = weights?.[person.id] ?? (isSelected ? 1 : 0);
        const hasShare = share > 0;

        return (
          <div
            key={person.id}
            className={cn(
              'flex items-center gap-3 rounded-[18px] px-3 py-2.5 transition-colors',
              hasShare ? 'bg-cream' : 'border border-dashed border-cream-dim',
            )}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <PersonAvatar
                name={person.name}
                colorIndex={personIndex}
                size="sm"
                dimmed={!hasShare}
              />
              <div className="min-w-0">
                <span
                  className={cn(
                    'block truncate text-sm font-semibold',
                    hasShare ? 'text-ink' : 'text-ink2',
                  )}
                >
                  {person.name}
                </span>
                {hasShare && (
                  <span className="text-[10px] text-ink2">
                    {share} {share === 1 ? 'share' : 'shares'}
                  </span>
                )}
              </div>
            </div>
            <div
              className={cn(
                'flex items-center gap-1 rounded-full p-1',
                hasShare ? 'bg-bg' : 'bg-cream',
              )}
            >
              <button
                type="button"
                data-testid={`assign-weight-decrement-${person.id}`}
                onClick={() => onWeightChange(person.id, -1)}
                disabled={!hasShare}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-cream-dim text-ink transition-colors hover:bg-cream disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-sm">remove</span>
              </button>
              {hasShare ? (
                <input
                  type="text"
                  inputMode="numeric"
                  data-testid={`assign-weight-value-${person.id}`}
                  value={share}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10);
                    if (!isNaN(parsed)) onWeightSet(person.id, parsed);
                  }}
                  onBlur={(e) => {
                    const parsed = parseInt(e.target.value, 10);
                    onWeightSet(person.id, isNaN(parsed) ? 1 : parsed);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  className="w-8 bg-transparent text-center text-sm font-semibold text-ink focus:outline-none"
                />
              ) : (
                <span
                  data-testid={`assign-weight-value-${person.id}`}
                  className="w-8 text-center text-sm font-semibold text-ink2/50 tabular-nums"
                >
                  0
                </span>
              )}
              <button
                type="button"
                data-testid={`assign-weight-increment-${person.id}`}
                onClick={() => onWeightChange(person.id, 1)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-white transition-colors hover:opacity-90"
              >
                <span className="material-symbols-outlined text-sm">add</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Orbit View (≤6 people) ──

function AssignOrbitView({
  activeItem,
  items,
  people,
  selectedIds,
  weights,
  unequalMode,
  canToggleUnequal,
  totalWeight,
  priceCents,
  currency,
  isAssigned,
  canSplitRest,
  activeItemIndex,
  itemAccentColor,
  onTogglePerson,
  onSelectAll,
  onSelectNone,
  onSplitRest,
  onUnequalToggle,
  onWeightChange,
  onWeightSet,
  onActiveItemIndexChange,
  onUpdateItem,
}: ViewProps) {
  const ORBIT_RADIUS = 120;
  const CONTAINER_HEIGHT = 280;

  return (
    <div className="mx-auto max-w-md space-y-5 pt-3">
      {/* Item counter */}
      <div className="flex items-center justify-between">
        <p
          data-testid="assign-item-counter"
          className="font-body text-xs font-semibold tracking-widest text-ink2 uppercase"
        >
          Item {activeItemIndex + 1} of {items.length}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="assign-select-all-btn"
            onClick={onSelectAll}
            disabled={people.length === 0}
            className="rounded-full bg-cream px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-cream-dim disabled:opacity-40"
          >
            All
          </button>
          <button
            type="button"
            data-testid="assign-select-none-btn"
            onClick={onSelectNone}
            disabled={people.length === 0}
            className="rounded-full bg-cream px-3 py-1.5 text-xs font-semibold text-ink2 transition-colors hover:bg-cream-dim disabled:opacity-40"
          >
            None
          </button>
          <button
            type="button"
            data-testid="assign-split-rest-btn"
            onClick={onSplitRest}
            disabled={!canSplitRest}
            className="rounded-full bg-cream px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-cream-dim disabled:opacity-40"
          >
            Split remaining
          </button>
          <button
            type="button"
            data-testid="assign-prev-item-btn"
            onClick={() => onActiveItemIndexChange(Math.max(0, activeItemIndex - 1))}
            disabled={activeItemIndex === 0}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-cream text-ink transition-colors hover:bg-cream-dim disabled:opacity-30"
          >
            <span className="material-symbols-outlined text-sm">chevron_left</span>
          </button>
          <button
            type="button"
            data-testid="assign-next-item-btn"
            onClick={() => onActiveItemIndexChange(Math.min(items.length - 1, activeItemIndex + 1))}
            disabled={activeItemIndex >= items.length - 1}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-cream text-ink transition-colors hover:bg-cream-dim disabled:opacity-30"
          >
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        </div>
      </div>

      {/* Headline */}
      <div>
        <h2 className="font-display text-3xl leading-tight font-medium tracking-tight text-ink sm:text-4xl">
          Who had the <span className="font-display italic">{activeItem.name || 'this item'}?</span>
        </h2>
      </div>

      {/* Plate + orbiting people */}
      <div className="relative mx-auto" style={{ height: CONTAINER_HEIGHT, width: '100%' }}>
        {/* Center plate circle */}
        <div
          className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full"
          style={{
            width: 200,
            height: 200,
            background: itemAccentColor,
            boxShadow: '0 30px 60px rgba(0,0,0,0.08), inset 0 0 0 8px rgba(255,255,255,0.35)',
          }}
        >
          <div
            className="font-display text-4xl leading-none font-semibold tracking-tight text-ink"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {priceCents !== null ? formatCurrencyFromCents(priceCents, currency) : '—'}
          </div>
          {selectedIds.length > 0 && totalWeight > 0 && priceCents !== null && (
            <div className="mt-1 font-body text-xs font-semibold tracking-widest text-ink/60 uppercase">
              ÷ {selectedIds.length} ={' '}
              {formatCurrencyFromCents(Math.round(priceCents / selectedIds.length), currency)}
            </div>
          )}

          {/* Assignment status indicator */}
          <div
            data-testid="assign-item-status"
            data-assigned={isAssigned ? 'true' : 'false'}
            className="sr-only"
          >
            {isAssigned ? 'Assigned' : 'Select one or more people'}
          </div>
        </div>

        {/* Orbiting person orbs */}
        {people.map((person, i) => {
          const angle = (i / people.length) * 2 * Math.PI - Math.PI / 2;
          const x = Math.cos(angle) * ORBIT_RADIUS;
          const y = Math.sin(angle) * ORBIT_RADIUS;
          const isSelected = selectedIds.includes(person.id);

          return (
            <button
              key={person.id}
              type="button"
              data-testid={`assign-person-btn-${person.id}`}
              aria-pressed={isSelected}
              onClick={() => onTogglePerson(person.id, !isSelected)}
              onDoubleClick={() => {
                onUpdateItem(activeItem.id, (current) => ({
                  ...current,
                  assignment: { mode: 'equal', personId: '', personIds: [person.id] },
                }));
              }}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 transition-transform active:scale-95"
              style={{
                left: `calc(50% + ${x}px)`,
                top: `calc(50% + ${y}px)`,
              }}
            >
              <PersonAvatar
                name={person.name}
                colorIndex={i}
                size={isSelected ? 'xl' : 'lg'}
                selected={isSelected}
                dimmed={!isSelected}
              />
              <span
                className="font-body text-[10px] font-semibold text-ink2"
                style={{ maxWidth: 48 }}
              >
                {person.name.length > 6 ? person.name.slice(0, 5) + '…' : person.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Split mode toggle */}
      <SplitModeToggle
        unequalMode={unequalMode}
        canToggleUnequal={canToggleUnequal}
        onUnequalToggle={onUnequalToggle}
      />

      {/* Weight controls */}
      {unequalMode && canToggleUnequal && (
        <WeightControls
          selectedIds={selectedIds}
          people={people}
          weights={weights}
          onWeightChange={onWeightChange}
          onWeightSet={onWeightSet}
        />
      )}

      {/* Item queue */}
      <div>
        <p className="mb-2 text-[10px] font-semibold tracking-widest text-ink2 uppercase">Queue</p>
        <div className="flex flex-col gap-1.5">
          {items.map((item, idx) => {
            const accent = ITEM_ACCENT_COLORS[idx % ITEM_ACCENT_COLORS.length];
            const isActive = idx === activeItemIndex;
            const isDone = item.assignment.personIds.length > 0;
            return (
              <div
                key={item.id}
                className={cn(
                  'flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors',
                  isActive
                    ? 'bg-ink text-white'
                    : isDone
                      ? 'bg-cream text-ink'
                      : 'bg-cream/50 text-ink2',
                )}
              >
                <div className="h-5 w-5 flex-shrink-0 rounded-md" style={{ background: accent }} />
                <span className="flex-1 truncate text-sm font-medium">
                  {item.name || `Item ${idx + 1}`}
                </span>
                {isDone && !isActive && (
                  <div className="flex">
                    {item.assignment.personIds.slice(0, 3).map((pid, j) => {
                      const pIdx = people.findIndex((p) => p.id === pid);
                      const p = people.find((p) => p.id === pid);
                      if (!p) return null;
                      const color = getPersonColor(pIdx);
                      return (
                        <div
                          key={pid}
                          className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-bg text-[8px] font-bold text-white"
                          style={{
                            backgroundColor: color.avatarBg,
                            marginLeft: j === 0 ? 0 : -6,
                          }}
                        >
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                      );
                    })}
                  </div>
                )}
                {isActive && (
                  <span className="font-body text-[10px] font-semibold opacity-70">NOW</span>
                )}
                {!isDone && !isActive && (
                  <span className="font-body text-[10px] font-semibold opacity-60">—</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Grid View (7+ people) ──

function AssignGridView({
  activeItem,
  items,
  people,
  selectedIds,
  weights,
  unequalMode,
  canToggleUnequal,
  totalWeight,
  priceCents,
  currency,
  isAssigned,
  canSplitRest,
  activeItemIndex,
  itemAccentColor,
  onTogglePerson,
  onSelectAll,
  onSelectNone,
  onSplitRest,
  onUnequalToggle,
  onWeightChange,
  onWeightSet,
  onActiveItemIndexChange,
  onUpdateItem,
}: ViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [lastSelectedIds, setLastSelectedIds] = useState<string[]>([]);

  const filteredPeople = people.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleActiveItemIndexChange = (index: number) => {
    setLastSelectedIds(selectedIds);
    onActiveItemIndexChange(index);
  };

  const handleSameAsLast = () => {
    if (!activeItem || lastSelectedIds.length === 0) return;
    onUpdateItem(activeItem.id, (current) => ({
      ...current,
      assignment: { ...current.assignment, personIds: lastSelectedIds, weights: undefined },
    }));
  };

  return (
    <div className="space-y-4 pt-3">
      {/* Overline + nav */}
      <div className="flex items-center justify-between">
        <p
          data-testid="assign-item-counter"
          className="text-xs font-semibold tracking-widest text-ink2 uppercase"
        >
          Item {activeItemIndex + 1} of {items.length} · party of {people.length}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="assign-split-rest-btn"
            onClick={onSplitRest}
            disabled={!canSplitRest}
            className="rounded-full bg-cream px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-cream-dim disabled:opacity-40"
          >
            Split remaining
          </button>
          <button
            type="button"
            data-testid="assign-prev-item-btn"
            onClick={() => handleActiveItemIndexChange(Math.max(0, activeItemIndex - 1))}
            disabled={activeItemIndex === 0}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-cream text-ink disabled:opacity-30"
          >
            <span className="material-symbols-outlined text-sm">chevron_left</span>
          </button>
          <button
            type="button"
            data-testid="assign-next-item-btn"
            onClick={() =>
              handleActiveItemIndexChange(Math.min(items.length - 1, activeItemIndex + 1))
            }
            disabled={activeItemIndex >= items.length - 1}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-cream text-ink disabled:opacity-30"
          >
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        </div>
      </div>

      {/* Editorial headline */}
      <h2 className="font-display text-3xl leading-tight font-medium tracking-tight text-ink">
        Who had the <span className="italic">{activeItem.name || 'this item'}?</span>
      </h2>

      {/* Compact item header */}
      <div className="flex items-center gap-3 rounded-[22px] bg-ink px-4 py-3 text-white">
        <div
          className="h-10 w-10 flex-shrink-0 rounded-xl"
          style={{ background: itemAccentColor }}
        />
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-medium">
            {activeItem.name || 'Untitled item'}
          </div>
          <div className="font-body text-xs opacity-70">
            ÷ {selectedIds.length || 1} ={' '}
            {priceCents !== null
              ? formatCurrencyFromCents(
                  Math.round(priceCents / (selectedIds.length || 1)),
                  currency,
                )
              : '—'}{' '}
            each
          </div>
        </div>
        <div
          className="font-display text-2xl font-semibold"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {priceCents !== null ? formatCurrencyFromCents(priceCents, currency) : '—'}
        </div>
        <div
          data-testid="assign-item-status"
          data-assigned={isAssigned ? 'true' : 'false'}
          className="sr-only"
        />
      </div>

      {/* Search */}
      <div className="flex flex-1 items-center gap-2 rounded-[14px] bg-cream px-3 py-2.5">
        <span className="material-symbols-outlined text-sm text-ink2">search</span>
        <input
          type="text"
          placeholder="Find a name…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink2/60"
        />
        {selectedIds.length > 0 && (
          <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold text-white">
            {selectedIds.length} selected
          </span>
        )}
      </div>

      {/* Split mode toggle */}
      <SplitModeToggle
        unequalMode={unequalMode}
        canToggleUnequal={canToggleUnequal}
        onUnequalToggle={onUnequalToggle}
        equalLabel="Equal"
      />

      {/* People grid (5 cols) or share steppers */}
      {unequalMode && canToggleUnequal ? (
        <WeightControls
          selectedIds={selectedIds}
          people={people}
          weights={weights}
          onWeightChange={onWeightChange}
          onWeightSet={onWeightSet}
        />
      ) : (
        <div className="grid grid-cols-5 gap-x-2 gap-y-4 sm:grid-cols-6 md:grid-cols-8">
          {filteredPeople.map((person) => {
            const personIndex = people.findIndex((p) => p.id === person.id);
            const isSelected = selectedIds.includes(person.id);
            const personWeight = weights?.[person.id] ?? 1;
            const shareAmount =
              isSelected && priceCents !== null && totalWeight > 0
                ? Math.round((priceCents * personWeight) / totalWeight)
                : null;
            return (
              <button
                key={person.id}
                type="button"
                data-testid={`assign-person-btn-${person.id}`}
                aria-pressed={isSelected}
                onClick={() => onTogglePerson(person.id, !isSelected)}
                onDoubleClick={() => {
                  onUpdateItem(activeItem.id, (current) => ({
                    ...current,
                    assignment: { mode: 'equal', personId: '', personIds: [person.id] },
                  }));
                }}
                className="flex flex-col items-center gap-1 active:scale-95"
              >
                <PersonAvatar
                  name={person.name}
                  colorIndex={personIndex}
                  size="md"
                  selected={isSelected}
                  dimmed={!isSelected}
                />
                <span
                  className={cn(
                    'max-w-[44px] truncate text-[10px] leading-tight font-semibold',
                    isSelected ? 'text-ink' : 'text-ink2',
                  )}
                >
                  {person.name}
                </span>
                {shareAmount !== null && (
                  <span className="text-[9px] font-medium text-ink2">
                    {formatCurrencyFromCents(shareAmount, currency)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Bulk actions */}
      <div className="flex gap-2">
        <button
          type="button"
          data-testid="assign-select-all-btn"
          onClick={onSelectAll}
          disabled={people.length === 0}
          className="flex-1 rounded-[14px] bg-cream py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-cream-dim disabled:opacity-40"
        >
          Everyone
        </button>
        <button
          type="button"
          data-testid="assign-select-none-btn"
          onClick={onSelectNone}
          disabled={people.length === 0}
          className="flex-1 rounded-[14px] bg-cream py-2.5 text-sm font-semibold text-ink2 transition-colors hover:bg-cream-dim disabled:opacity-40"
        >
          None
        </button>
        <button
          type="button"
          data-testid="assign-same-as-last-btn"
          onClick={handleSameAsLast}
          disabled={lastSelectedIds.length === 0}
          className="flex-1 rounded-[14px] bg-cream py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-cream-dim disabled:opacity-40"
        >
          Same as last
        </button>
      </div>

      {/* Double-tap hint */}
      <p className="text-[11px] text-ink2/60 italic">Double-tap a person to assign only them.</p>
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
    <div className="space-y-4 pt-3">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-2xl font-medium text-ink">
          Review <span className="italic">assignments</span>
        </h2>
        <span className="text-sm text-ink2">
          {items.length} item{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-2">
        {items.length === 0 && (
          <p className="py-12 text-center text-sm text-ink2">No items available yet.</p>
        )}
        {items.map((item, index) => {
          const selectedPeople = people.filter((person) =>
            item.assignment.personIds.includes(person.id),
          );
          const isItemDone = selectedPeople.length > 0;
          const priceCents = parseCurrencyToCents(item.amountInput);
          const itemWeights = item.assignment.weights;
          const hasUnequalWeights =
            itemWeights !== undefined &&
            item.assignment.personIds.length >= 2 &&
            item.assignment.personIds.some((id) => (itemWeights[id] ?? 1) !== 1);
          const splitLabel = hasUnequalWeights
            ? selectedPeople.map((p) => `${p.name} ×${itemWeights?.[p.id] ?? 1}`).join(', ')
            : selectedPeople.map((p) => p.name).join(', ');

          const accentColor = ITEM_ACCENT_COLORS[index % ITEM_ACCENT_COLORS.length];

          return (
            <article
              key={item.id}
              className={cn(
                'flex items-center gap-3 rounded-[18px] p-4 transition-all',
                isItemDone ? 'bg-cream' : 'bg-accent-red/10',
              )}
            >
              <div
                className="h-8 w-8 flex-shrink-0 rounded-xl"
                style={{ background: accentColor }}
              />
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate font-semibold text-ink">
                  {item.name || `Item ${index + 1}`}
                </p>
                {priceCents !== null && (
                  <span className="block font-display text-sm font-medium text-ink2">
                    {formatCurrencyFromCents(priceCents)}
                  </span>
                )}
                <span className={cn('block text-xs', isItemDone ? 'text-ink2' : 'text-error')}>
                  {isItemDone ? splitLabel || '—' : 'No people selected'}
                </span>
              </div>
              <button
                type="button"
                data-testid="wizard-edit-btn"
                onClick={() => onEditItem(index)}
                className="flex shrink-0 items-center gap-1 rounded-full bg-bg px-3 py-1.5 text-sm font-semibold text-ink transition-all hover:bg-cream-dim"
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
