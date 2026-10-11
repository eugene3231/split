import { useId } from 'react';
import { cn } from '@shared/utils/cn';
import type { ClaimItem } from '@features/split-workspace/logic/claim';
import type { ShareInput, ShareStep } from '@features/split-workspace/logic/itemShare';
import { ClaimantAvatars } from './ClaimantAvatars';
import { ItemActionChip } from './ItemActionChip';
import { ShareAmountField } from './ShareAmountField';
import { ShareStepper } from './ShareStepper';
import { useDesktopPopover } from './useDesktopPopover';

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
  const controlsId = useId();
  useDesktopPopover(controlsId);

  return (
    <li data-testid={`claim-item-${item.id}`} className="flex items-center gap-1 py-3 md:gap-3">
      <div className="min-w-0 flex-1">
        <button
          type="button"
          aria-label={item.name}
          title={item.name}
          aria-pressed={item.claimedByActive}
          data-testid={`claim-item-toggle-${item.id}`}
          onClick={onToggle}
          className="flex h-12 w-full items-center gap-1 text-left md:gap-3"
        >
          <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center">
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors',
                item.claimedByActive ? 'border-primary bg-primary' : 'border-outline-variant',
              )}
            >
              {item.claimedByActive && (
                <span className="material-symbols-outlined text-base text-on-primary">check</span>
              )}
            </span>
          </span>
          <span className="line-clamp-2 min-w-0 leading-6 font-semibold break-words">
            {item.name}
          </span>
        </button>
        <div className="h-5 min-w-0 pl-12 md:pl-14">
          <ClaimantAvatars
            claimants={item.claimants}
            leftLabel={item.leftLabel}
            testId={`claim-item-claimants-${item.id}`}
          />
        </div>
      </div>
      {share ? (
        <ShareAmountField
          label={share.amountLabel}
          onCommit={onSetShare}
          testId={`claim-item-amount-${item.id}`}
        />
      ) : (
        <span
          title={item.priceLabel}
          className="flex h-11 w-16 shrink-0 items-center justify-end text-right text-sm text-on-surface-variant tabular-nums md:w-24"
        >
          <span className="truncate">{item.priceLabel}</span>
        </span>
      )}
      <div className="w-11 shrink-0 md:hidden">
        <button
          type="button"
          popoverTarget={controlsId}
          aria-label={
            share
              ? `Adjust share for ${item.name}, ${share.label}`
              : `Item details for ${item.name}`
          }
          data-testid={`claim-item-${share ? 'controls' : 'details'}-${item.id}`}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant text-sm font-bold tabular-nums"
        >
          {share ? (
            share.label
          ) : (
            <span aria-hidden className="material-symbols-outlined">
              more_horiz
            </span>
          )}
        </button>
      </div>
      <div className="w-0 shrink-0 md:w-60">
        <div
          id={controlsId}
          popover="auto"
          className="fixed inset-auto right-6 bottom-6 m-0 max-w-[calc(100vw-3rem)] flex-col gap-3 rounded-2xl border border-outline-variant bg-surface p-4 text-on-surface shadow-xl md:static md:flex md:w-60 md:flex-row md:items-center md:gap-2 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none [&:popover-open]:flex"
        >
          <p className="max-w-64 font-semibold break-words md:hidden">{item.name}</p>
          <p className="break-words md:hidden">Item total: {item.priceLabel}</p>
          {share && <p className="break-words md:hidden">Your share: {share.amountLabel}</p>}
          {share && (
            <>
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
              <ShareStepper
                share={share}
                onStep={onStepShare}
                testId={`claim-item-share-${item.id}`}
              />
            </>
          )}
        </div>
      </div>
    </li>
  );
}
