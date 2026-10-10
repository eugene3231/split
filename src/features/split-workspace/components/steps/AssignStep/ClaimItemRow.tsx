import { useState } from 'react';
import { cn } from '@shared/utils/cn';
import type { ClaimItem } from '@features/split-workspace/logic/claim';
import type { ShareInput, ShareStep } from '@features/split-workspace/logic/itemShare';
import { ItemActionChip } from './ItemActionChip';
import { ShareAmountField } from './ShareAmountField';
import { ShareStepper } from './ShareStepper';

interface Props {
  item: ClaimItem;
  personName: string;
  onToggle: () => void;
  onStepShare: (step: ShareStep) => void;
  onSetShare: (input: ShareInput) => void;
  onSplitEvenly: () => void;
  onTakeAlone: () => void;
}

export function ClaimItemRow({
  item,
  personName,
  onToggle,
  onStepShare,
  onSetShare,
  onSplitEvenly,
  onTakeAlone,
}: Props) {
  const [editing, setEditing] = useState(false);
  const { share } = item;
  const runAction = (action: () => void) => {
    action();
    setEditing(false);
  };

  return (
    <li data-testid={`claim-item-${item.id}`} className="flex flex-wrap items-center gap-x-3 py-3">
      <button
        type="button"
        aria-pressed={item.claimedByActive}
        data-testid={`claim-item-toggle-${item.id}`}
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span
          aria-hidden
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
            item.claimedByActive ? 'border-primary bg-primary' : 'border-outline-variant',
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
              className="block text-xs text-on-surface-variant"
            >
              {item.claimantsLabel}
            </span>
          )}
        </span>
      </button>

      {share ? (
        <>
          <ShareStepper share={share} onStep={onStepShare} testId={`claim-item-share-${item.id}`} />
          <ShareAmountField
            label={share.amountLabel}
            editing={editing}
            onEditingChange={setEditing}
            onCommit={onSetShare}
            testId={`claim-item-amount-${item.id}`}
          />
        </>
      ) : (
        <span className="min-w-18 shrink-0 text-right text-on-surface-variant tabular-nums">
          {item.priceLabel}
        </span>
      )}

      {editing && share && (share.canSplitEvenly || share.canTakeAlone) && (
        <div className="flex basis-full justify-end gap-2 pt-2">
          {share.canSplitEvenly && (
            <ItemActionChip
              icon="group"
              label="Split evenly"
              testId={`claim-item-split-evenly-${item.id}`}
              onClick={() => runAction(onSplitEvenly)}
            />
          )}
          {share.canTakeAlone && (
            <ItemActionChip
              icon="person"
              label={`Just ${personName}`}
              testId={`claim-item-take-alone-${item.id}`}
              onClick={() => runAction(onTakeAlone)}
            />
          )}
        </div>
      )}
    </li>
  );
}
