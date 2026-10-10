import type { ReactNode } from 'react';
import { cn } from '@shared/utils/cn';
import type { ClaimItem } from '@features/split-workspace/logic/claim';
import { AvatarStack } from './AvatarStack';

interface Props {
  item: ClaimItem;
  onToggle: () => void;
  onShareWithEveryone: () => void;
  onAdjustSplit: () => void;
}

export function ClaimItemTile({ item, onToggle, onShareWithEveryone, onAdjustSplit }: Props) {
  const unclaimed = item.claimants.length === 0;

  return (
    <li
      data-testid={`claim-item-${item.id}`}
      className={cn(
        'overflow-hidden rounded-2xl border-2 transition-all',
        item.claimedByActive && 'border-primary bg-surface-container-lowest shadow-sm',
        unclaimed && 'border-dashed border-outline-variant',
        !unclaimed && !item.claimedByActive && 'border-transparent bg-surface-container-low',
      )}
    >
      <button
        type="button"
        aria-pressed={item.claimedByActive}
        data-testid={`claim-item-toggle-${item.id}`}
        onClick={onToggle}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <span
          aria-hidden
          className={cn(
            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all',
            item.claimedByActive ? 'border-primary bg-primary' : 'border-outline-variant',
          )}
        >
          {item.claimedByActive && (
            <span className="material-symbols-outlined text-lg text-on-primary">check</span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 font-semibold break-words">{item.name}</span>
            <span className="shrink-0 font-bold tabular-nums">{item.priceLabel}</span>
          </span>
          <span className="mt-1 flex items-center justify-between gap-3">
            <span
              data-testid={`claim-item-share-${item.id}`}
              className="min-w-0 text-xs text-on-surface-variant"
            >
              {item.shareLabel}
            </span>
            <AvatarStack people={item.claimants} />
          </span>
        </span>
      </button>
      {unclaimed && (
        <TileAction
          onClick={onShareWithEveryone}
          testId={`claim-item-everyone-${item.id}`}
          className="border-dashed"
        >
          Everyone shared this
        </TileAction>
      )}
      {item.canAdjustSplit && (
        <TileAction
          onClick={onAdjustSplit}
          testId={`claim-item-adjust-${item.id}`}
          className={item.claimedByActive ? 'border-primary/15' : 'border-surface-container-high'}
        >
          <span className="material-symbols-outlined text-sm">tune</span>
          Adjust split
        </TileAction>
      )}
    </li>
  );
}

interface TileActionProps {
  onClick: () => void;
  className?: string;
  testId?: string;
  children: ReactNode;
}

function TileAction({ onClick, className, testId, children }: TileActionProps) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-center gap-1 border-t border-outline-variant py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface',
        className,
      )}
    >
      {children}
    </button>
  );
}
