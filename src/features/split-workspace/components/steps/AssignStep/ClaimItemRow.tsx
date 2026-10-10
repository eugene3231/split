import { useState } from 'react';
import { cn } from '@shared/utils/cn';
import type { ClaimItem } from '@features/split-workspace/logic/claim';
import type { ShareInput, ShareStep } from '@features/split-workspace/logic/itemShare';
import { ShareAmountField } from './ShareAmountField';
import { ShareStepper } from './ShareStepper';
import { TreatChip } from './TreatChip';

interface Props {
  item: ClaimItem;
  personName: string;
  onToggle: () => void;
  onStepShare: (step: ShareStep) => void;
  onSetShare: (input: ShareInput) => void;
  onTreat: () => void;
  onUntreat: () => void;
}

export function ClaimItemRow({
  item,
  personName,
  onToggle,
  onStepShare,
  onSetShare,
  onTreat,
  onUntreat,
}: Props) {
  const [editing, setEditing] = useState(false);
  const { share, treat } = item;
  const lockedByOther = treat !== null && !treat.byActive;

  return (
    <li
      data-testid={`claim-item-${item.id}`}
      className={cn('flex flex-wrap items-center gap-x-3 py-3', lockedByOther && 'opacity-50')}
    >
      <button
        type="button"
        aria-pressed={item.claimedByActive}
        data-testid={`claim-item-toggle-${item.id}`}
        disabled={lockedByOther}
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span
          aria-hidden
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
            item.claimedByActive ? 'border-primary bg-primary' : 'border-outline-variant',
            lockedByOther && 'border-dashed',
          )}
        >
          {item.claimedByActive && (
            <span className="material-symbols-outlined text-base text-on-primary">check</span>
          )}
        </span>
        <span className="min-w-0">
          <span className="block font-semibold break-words">{item.name}</span>
          {item.claimantsLabel && (
            <span
              data-testid={`claim-item-claimants-${item.id}`}
              className="flex items-center gap-1 text-xs text-on-surface-variant"
            >
              {treat && (
                <span aria-hidden className="material-symbols-outlined text-sm">
                  redeem
                </span>
              )}
              {item.claimantsLabel}
            </span>
          )}
        </span>
      </button>

      {share ? (
        <>
          {!treat && (
            <ShareStepper
              share={share}
              onStep={onStepShare}
              testId={`claim-item-share-${item.id}`}
            />
          )}
          <ShareAmountField
            label={share.amountLabel}
            editing={editing}
            onEditingChange={setEditing}
            onCommit={onSetShare}
            testId={`claim-item-amount-${item.id}`}
          />
        </>
      ) : (
        <span
          className={cn(
            'min-w-18 shrink-0 text-right text-on-surface-variant tabular-nums',
            lockedByOther && 'line-through',
          )}
        >
          {item.priceLabel}
        </span>
      )}

      {editing && (
        <div className="flex basis-full justify-end pt-2">
          <TreatChip
            label={treat ? 'Undo treat' : `${personName} treats`}
            testId={`claim-item-treat-${item.id}`}
            onClick={() => {
              if (treat) onUntreat();
              else onTreat();
              setEditing(false);
            }}
          />
        </div>
      )}
    </li>
  );
}
