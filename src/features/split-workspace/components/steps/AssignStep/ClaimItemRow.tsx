import { Checkbox } from 'radix-ui';
import type { ClaimItem } from '@features/split-workspace/logic/claim';
import type { ShareInput, ShareStep } from '@features/split-workspace/logic/itemShare';
import { cn } from '@shared/utils/cn';
import { ClaimantAvatars } from './ClaimantAvatars';
import { ClaimCheckMark } from './ClaimCheckMark';
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
  const { share } = item;

  return (
    <li
      data-testid={`claim-item-${item.id}`}
      data-taken={item.takenByOthers || undefined}
      className="py-1.5"
    >
      <div className="flex items-center gap-2 md:gap-3">
        <Checkbox.Root
          aria-label={item.name}
          checked={item.claimedByActive}
          data-testid={`claim-item-toggle-${item.id}`}
          onCheckedChange={onToggle}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
        >
          <ClaimCheckMark checked={item.claimedByActive} />
          <span className="min-w-0 leading-tight">
            <span
              className={cn(
                'block break-words',
                item.takenByOthers ? 'text-on-surface-variant' : 'font-semibold',
              )}
            >
              {item.name}
            </span>
            {item.leftLabel && (
              <span className="block text-xs text-on-surface-variant">{item.leftLabel}</span>
            )}
          </span>
        </Checkbox.Root>
        {/* Outside the toggle, so tapping an avatar names the person instead of ticking the item. */}
        <ClaimantAvatars
          claimants={item.claimants}
          leftLabel={item.leftLabel}
          testId={`claim-item-claimants-${item.id}`}
        />
        <div className="flex shrink-0 justify-end md:w-28">
          {share ? (
            <ShareAmountField
              label={share.amountLabel}
              onCommit={onSetShare}
              testId={`claim-item-amount-${item.id}`}
            />
          ) : (
            <span className="text-on-surface-variant tabular-nums">{item.priceLabel}</span>
          )}
        </div>
      </div>
      {share && (
        <div className="flex items-center gap-2 pb-1 pl-9 motion-safe:animate-rise-in">
          <ShareStepper share={share} onStep={onStepShare} testId={`claim-item-share-${item.id}`} />
          <div className="flex min-w-0 flex-1 justify-end gap-1.5">
            <ItemActionChip
              icon="groups"
              label="Everyone"
              description="Split evenly with everyone"
              disabled={!share.canSplitEvenly}
              testId={`claim-item-split-evenly-${item.id}`}
              onClick={onSplitEvenly}
            />
            <ItemActionChip
              icon="person"
              label={`Only ${personName}`}
              description={`Only ${personName} had this`}
              disabled={!share.canTakeAlone}
              testId={`claim-item-take-alone-${item.id}`}
              onClick={onTakeAlone}
            />
          </div>
        </div>
      )}
    </li>
  );
}
