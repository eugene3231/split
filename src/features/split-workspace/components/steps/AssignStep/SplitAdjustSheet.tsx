import { getCurrencySymbol, parseCurrencyToCents } from '@shared/logic/core/money';
import type {
  AssignmentCommand,
  SplitAdjustment,
  SplitAdjustmentRow,
} from '@features/split-workspace/logic/assignmentInteraction';
import { PersonAvatar } from '@features/split-workspace/components/shared/PersonAvatar';
import { InlineStepper } from './InlineStepper';
import { ModeTabs } from './ModeTabs';
import { RawBufferInput } from './RawBufferInput';
import { SplitEquallyButton } from './SplitEquallyButton';

interface Props {
  adjustment: SplitAdjustment;
  currency: string;
  onCommand: (command: AssignmentCommand) => void;
  onClose: () => void;
}

function focusOnMount(element: HTMLDivElement | null) {
  element?.focus();
}

export function SplitAdjustSheet({ adjustment, currency, onCommand, onClose }: Props) {
  const isCustom = adjustment.claimants.some(
    (row) => row.weight !== adjustment.claimants[0].weight,
  );

  return (
    <div
      className="fixed inset-0 z-60 flex items-end justify-center md:items-center md:p-4"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <div
        className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={focusOnMount}
        role="dialog"
        aria-modal="true"
        aria-labelledby="split-adjust-title"
        tabIndex={-1}
        data-testid="split-adjust-sheet"
        className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface-container-lowest p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl outline-none md:rounded-3xl md:p-6"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-outline-variant md:hidden" />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-on-surface-variant">Adjust split</p>
            <h2
              id="split-adjust-title"
              className="font-headline text-xl font-extrabold tracking-tight break-words"
            >
              {adjustment.title}
            </h2>
            <p className="text-sm font-bold text-on-surface-variant tabular-nums">
              {adjustment.priceLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <ModeTabs
          mode={adjustment.weightsInputMode}
          onModeChange={(mode) => onCommand({ type: 'set-weights-input-mode', mode })}
          className="mt-4"
        />

        <ul className="mt-3 divide-y divide-surface-container-high">
          {adjustment.claimants.map((row) => (
            <li key={row.id} className="flex items-center gap-3 py-3">
              <PersonAvatar name={row.name} colorIndex={row.colorIndex} className="h-8 w-8" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{row.name}</p>
                <p
                  data-testid={`split-adjust-share-${row.id}`}
                  className="text-xs text-on-surface-variant tabular-nums"
                >
                  {row.shareLabel}
                </p>
              </div>
              <ClaimantControl
                row={row}
                adjustment={adjustment}
                currency={currency}
                onCommand={onCommand}
              />
            </li>
          ))}
        </ul>

        {adjustment.weightsInputMode !== 'shares' && (
          <p className="mt-1 text-xs text-on-surface-variant">
            Type a value and tap away. The difference comes out of everyone else.
          </p>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <SplitEquallyButton
            onClick={() => onCommand({ type: 'reset-split-to-equal' })}
            disabled={!isCustom}
          />
          <button
            type="button"
            onClick={onClose}
            data-testid="split-adjust-done-btn"
            className="rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-on-primary transition-all active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// Unsimplified so the underlying shares stay visible: 3/12, not 1/4.
function formatShareFraction(weight: number, totalWeight: number): string {
  if (totalWeight === 0) return `${weight}`;
  if (weight === totalWeight) return 'Full';
  return `${weight}/${totalWeight}`;
}

function parsePercentInput(raw: string): number | null {
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

interface ClaimantControlProps {
  row: SplitAdjustmentRow;
  adjustment: SplitAdjustment;
  currency: string;
  onCommand: (command: AssignmentCommand) => void;
}

function ClaimantControl({ row, adjustment, currency, onCommand }: ClaimantControlProps) {
  if (adjustment.weightsInputMode === 'percent') {
    return (
      <RawBufferInput
        value={row.percentValue}
        onCommit={(value) => onCommand({ type: 'set-percent', personId: row.id, value })}
        format={(value) => String(value)}
        parse={parsePercentInput}
        suffix="%"
        testId={`assign-percent-${row.id}`}
      />
    );
  }

  if (adjustment.weightsInputMode === 'amount') {
    return (
      <RawBufferInput
        value={row.shareAmountCents}
        onCommit={(valueCents) => onCommand({ type: 'set-amount', personId: row.id, valueCents })}
        format={(cents) => (cents / 100).toFixed(2)}
        parse={parseCurrencyToCents}
        prefix={getCurrencySymbol(currency)}
        placeholder="0.00"
        inputMode="decimal"
        widthClassName="w-20"
        testId={`assign-amount-${row.id}`}
      />
    );
  }

  return (
    <InlineStepper
      weight={row.weight}
      display={formatShareFraction(row.weight, adjustment.totalWeight)}
      onDelta={(delta) => onCommand({ type: 'adjust-weight', personId: row.id, delta })}
      testId={`assign-weight-${row.id}`}
    />
  );
}
