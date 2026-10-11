import { cn } from '@shared/utils/cn';
import type { ClaimItem } from '@features/split-workspace/logic/claim';
import type { ShareInput, ShareStep } from '@features/split-workspace/logic/itemShare';
import { ClaimantAvatars } from './ClaimantAvatars';
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
      className="flex items-center gap-2 py-2 md:gap-3 md:py-3"
    >
      <div className="grid min-w-0 flex-1 grid-cols-[4.25rem_minmax(0,1fr)] gap-x-1 md:grid-cols-[minmax(0,1fr)_6rem] md:gap-x-3">
        <button
          type="button"
          aria-label={item.name}
          title={item.name}
          aria-pressed={item.claimedByActive}
          data-testid={`claim-item-toggle-${item.id}`}
          onClick={onToggle}
          className="col-span-2 flex min-h-12 w-full items-center gap-2 text-left md:col-span-1 md:gap-3"
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
          <span className="min-w-0 leading-6 font-semibold break-words">{item.name}</span>
        </button>
        <div className="col-start-2 row-start-2 flex h-11 min-w-0 items-center self-center md:row-span-2 md:row-start-1">
          {share ? (
            <ShareAmountField
              label={share.amountLabel}
              onCommit={onSetShare}
              testId={`claim-item-amount-${item.id}`}
            />
          ) : (
            <span className="block w-full overflow-x-auto text-right text-sm whitespace-nowrap text-on-surface-variant tabular-nums">
              {item.priceLabel}
            </span>
          )}
        </div>
        <div className="col-start-1 row-start-2 h-5 min-w-0 self-center md:pl-9">
          <ClaimantAvatars
            claimants={item.claimants}
            leftLabel={item.leftLabel}
            testId={`claim-item-claimants-${item.id}`}
          />
        </div>
      </div>
      <div className="grid h-24 w-32 shrink-0 grid-cols-2 justify-items-center gap-y-1 md:flex md:h-11 md:w-60 md:items-center md:gap-2">
        {share && (
          <>
            <div className="col-span-2 md:order-last">
              <ShareStepper
                share={share}
                onStep={onStepShare}
                testId={`claim-item-share-${item.id}`}
              />
            </div>
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
          </>
        )}
      </div>
    </li>
  );
}
