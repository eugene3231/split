import { cn } from '@shared/utils/cn';
import type { ClaimItem } from '@features/split-workspace/logic/claim';
import type { ShareInput, ShareStep } from '@features/split-workspace/logic/itemShare';
import { ClaimantAvatars } from './ClaimantAvatars';
import { ItemActionChip } from './ItemActionChip';
import { ItemActionMenu } from './ItemActionMenu';
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
  const actions = share && [
    {
      icon: 'groups',
      label: 'Split evenly',
      disabled: !share.canSplitEvenly,
      onSelect: onSplitEvenly,
      testId: `claim-item-split-evenly-${item.id}`,
    },
    {
      icon: 'person',
      label: `${personName} only`,
      disabled: !share.canTakeAlone,
      onSelect: onTakeAlone,
      testId: `claim-item-take-alone-${item.id}`,
    },
  ];

  return (
    // Wide screens put the controls between the name and the price. Narrow ones move them
    // under the price, beside the avatars, so the name keeps the first line.
    <li data-testid={`claim-item-${item.id}`} className="flex flex-wrap items-center gap-x-3 py-2">
      <button
        type="button"
        aria-label={item.name}
        aria-pressed={item.claimedByActive}
        data-testid={`claim-item-toggle-${item.id}`}
        onClick={onToggle}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
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
        <span className="min-w-0 font-semibold break-words">{item.name}</span>
      </button>
      <div className="order-last flex h-11 shrink-0 items-center justify-end gap-1 md:order-none md:w-60 md:gap-2">
        {share && actions && (
          <>
            <div className="hidden gap-2 md:flex">
              {actions.map(({ onSelect, ...action }) => (
                <ItemActionChip key={action.testId} {...action} onClick={onSelect} />
              ))}
            </div>
            <div className="md:hidden">
              <ItemActionMenu actions={actions} testId={`claim-item-more-${item.id}`} />
            </div>
            <ShareStepper
              share={share}
              onStep={onStepShare}
              testId={`claim-item-share-${item.id}`}
            />
          </>
        )}
      </div>
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
      <div aria-hidden className="basis-full" />
      {/* Outside the toggle, so tapping an avatar names the person instead of ticking the item. */}
      <div className="flex h-11 min-w-0 flex-1 items-center pl-9 md:h-6">
        <ClaimantAvatars
          claimants={item.claimants}
          leftLabel={item.leftLabel}
          testId={`claim-item-claimants-${item.id}`}
        />
      </div>
    </li>
  );
}
