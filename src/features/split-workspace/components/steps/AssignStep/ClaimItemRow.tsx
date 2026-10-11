import { Checkbox } from 'radix-ui';
import type { ClaimItem } from '@features/split-workspace/logic/claim';
import type { ShareInput, ShareStep } from '@features/split-workspace/logic/itemShare';
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
    <li data-testid={`claim-item-${item.id}`} className="py-2">
      <div className="flex items-center gap-2 md:gap-3">
        <Checkbox.Root
          aria-label={item.name}
          checked={item.claimedByActive}
          data-testid={`claim-item-toggle-${item.id}`}
          onCheckedChange={onToggle}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
        >
          <ClaimCheckMark checked={item.claimedByActive} />
          <span className="min-w-0 font-semibold break-words">{item.name}</span>
        </Checkbox.Root>
        {share && (
          <span className="motion-safe:animate-pop-in">
            <ShareStepper
              share={share}
              onStep={onStepShare}
              testId={`claim-item-share-${item.id}`}
            />
          </span>
        )}
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
      {/* Outside the toggle, so tapping an avatar names the person instead of ticking the item.
          Always rendered at a fixed height, so ticking an item never moves the rows below. */}
      <div className="flex h-9 items-center gap-2 pl-9">
        <div className="flex shrink-0 items-center">
          <ClaimantAvatars
            claimants={item.claimants}
            leftLabel={item.leftLabel}
            testId={`claim-item-claimants-${item.id}`}
          />
        </div>
        {share && (
          <div className="flex flex-1 justify-end gap-1 motion-safe:animate-rise-in">
            <ItemActionChip
              icon="groups"
              label="Split evenly"
              disabled={!share.canSplitEvenly}
              testId={`claim-item-split-evenly-${item.id}`}
              onClick={onSplitEvenly}
            />
            <ItemActionChip
              icon="person"
              label={`${personName} only`}
              disabled={!share.canTakeAlone}
              testId={`claim-item-take-alone-${item.id}`}
              onClick={onTakeAlone}
            />
          </div>
        )}
      </div>
    </li>
  );
}
