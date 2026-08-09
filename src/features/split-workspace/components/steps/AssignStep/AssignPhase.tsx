import type { ReactNode } from 'react';
import { parseCurrencyToCents } from '@shared/logic/core/money';
import type {
  AssignmentActiveItem,
  AssignmentAssignModel,
  AssignmentCommand,
  AssignmentPersonRow,
} from '@features/split-workspace/logic/assignmentInteraction';
import type { ItemsSubPhase } from '@features/split-workspace/types';
import { InlineStepper } from './InlineStepper';
import { PersonCard } from './PersonCard';
import { RawBufferInput } from './RawBufferInput';
import { SplitCard } from './SplitCard';
import { SplitEquallyButton } from './SplitEquallyButton';

type AssignPhaseProps = {
  model: AssignmentAssignModel;
  activeItemIndex: number;
  itemCount: number;
  onActiveItemIndexChange: (index: number) => void;
  onItemsSubPhaseChange: (phase: ItemsSubPhase) => void;
  onCommand: (command: AssignmentCommand) => void;
  onSplitUnassignedItemsEqually: () => void;
};

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

// GCD-reduced fraction for the Shares-tab stepper display only — the stored
// weights are never rewritten just by viewing this tab, so amount/percent
// magnitudes (e.g. 2880/1920) still display as a clean 3/5.
function formatShareFraction(weight: number, totalWeight: number): string {
  if (totalWeight === 0) return `${weight}`;
  if (weight === totalWeight) return 'Full';
  const divisor = gcd(weight, totalWeight);
  return `${weight / divisor}/${totalWeight / divisor}`;
}

function parsePercentInput(raw: string): number | null {
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function AssignPhase({
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

  const selectedCount = model.people.filter((person) => person.isSelected).length;
  const totalRawWeight = model.people
    .filter((person) => person.isSelected)
    .reduce((sum, person) => sum + person.weight, 0);

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

      <SplitCard
        mode={activeItem.weightsInputMode}
        onModeChange={(mode) => onCommand({ type: 'set-weights-input-mode', mode })}
        disabled={!activeItem.canUseSplitControls}
      />

      {/* Who's involved header */}
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold text-on-surface">Who's involved?</span>
        <div className="flex items-center gap-3">
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
          <SplitEquallyButton
            onClick={() => onCommand({ type: 'reset-split-to-equal' })}
            disabled={selectedCount < 2}
          />
        </div>
      </div>

      {/* Person cards */}
      <div className="flex flex-col gap-3">
        {model.people.map((person) => {
          const isSolo = person.isSelected && selectedCount === 1;
          const isFractional = person.isSelected && !isSolo;

          const { status, control } = resolvePersonStatusAndControl({
            person,
            isSolo,
            isFractional,
            activeItem,
            totalRawWeight,
            onCommand,
          });

          return (
            <PersonCard
              key={person.id}
              id={person.id}
              name={person.name}
              colorIndex={person.colorIndex}
              isSelected={person.isSelected}
              onClick={() =>
                onCommand({
                  type: 'toggle-person',
                  personId: person.id,
                  checked: !person.isSelected,
                })
              }
              onDoubleClick={() => onCommand({ type: 'assign-only', personId: person.id })}
              status={status}
              control={control}
            />
          );
        })}
      </div>

      {/* Double-tap hint */}
      <p className="flex items-center gap-1.5 text-xs text-on-surface-variant italic">
        <span className="material-symbols-outlined text-sm">info</span>
        Double-tap a person to assign only them.
        {activeItem.weightsInputMode !== 'shares' &&
          ' Enter a value and tab/click away — the difference is pulled from everyone else proportionally.'}
      </p>
    </div>
  );
}

function resolvePersonStatusAndControl(args: {
  person: AssignmentPersonRow;
  isSolo: boolean;
  isFractional: boolean;
  activeItem: AssignmentActiveItem;
  totalRawWeight: number;
  onCommand: (command: AssignmentCommand) => void;
}): { status: ReactNode; control: ReactNode } {
  const { person, isSolo, isFractional, activeItem, totalRawWeight, onCommand } = args;

  if (!person.isSelected) {
    return { status: 'Not involved', control: null };
  }

  if (isSolo) {
    return { status: person.shareLabel, control: null };
  }

  if (!isFractional) {
    return { status: null, control: null };
  }

  if (activeItem.weightsInputMode === 'percent') {
    return {
      status: person.shareLabel,
      control: (
        <RawBufferInput
          value={person.percentValue}
          onCommit={(value) => onCommand({ type: 'set-percent', personId: person.id, value })}
          format={(value) => String(value)}
          parse={parsePercentInput}
          suffix="%"
          testId={`assign-percent-${person.id}`}
        />
      ),
    };
  }

  if (activeItem.weightsInputMode === 'amount') {
    return {
      status: null,
      control: (
        <RawBufferInput
          value={person.shareAmountCents}
          onCommit={(valueCents) =>
            onCommand({ type: 'set-amount', personId: person.id, valueCents })
          }
          format={(cents) => (cents / 100).toFixed(2)}
          parse={parseCurrencyToCents}
          prefix="$"
          placeholder="0.00"
          inputMode="decimal"
          widthClassName="w-16"
          testId={`assign-amount-${person.id}`}
        />
      ),
    };
  }

  return {
    status: person.shareLabel,
    control: (
      <InlineStepper
        weight={person.weight}
        display={formatShareFraction(person.weight, totalRawWeight)}
        decrementDisabled={false}
        onDelta={(delta) => {
          if (delta < 0 && person.weight <= 1) {
            onCommand({ type: 'toggle-person', personId: person.id, checked: false });
            return;
          }
          onCommand({ type: 'adjust-weight', personId: person.id, delta });
        }}
        testId={`assign-weight-${person.id}`}
      />
    ),
  };
}
