import { cn } from '@shared/utils/cn';
import type { ClaimItem } from '@features/split-workspace/logic/claim';
import type { ShareInput, ShareStep } from '@features/split-workspace/logic/itemShare';
import { ShareAmountField } from './ShareAmountField';
import { ShareStepper } from './ShareStepper';

interface Props {
  item: ClaimItem;
  onToggle: () => void;
  onStepShare: (step: ShareStep) => void;
  onSetShare: (input: ShareInput) => void;
}

export function ClaimItemRow({ item, onToggle, onStepShare, onSetShare }: Props) {
  const { share } = item;

  return (
    <li data-testid={`claim-item-${item.id}`} className="flex items-center gap-3 py-3">
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
            onCommit={onSetShare}
            testId={`claim-item-amount-${item.id}`}
          />
        </>
      ) : (
        <span className="min-w-18 shrink-0 text-right text-on-surface-variant tabular-nums">
          {item.priceLabel}
        </span>
      )}
    </li>
  );
}
