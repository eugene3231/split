import { cn } from '@shared/utils/cn';
import { parseCurrencyToCents } from '@shared/logic/core/money';
import type { Person } from '@shared/types';
import { formatMoney } from '@features/ux-prototypes/logic/prototypeFormat';
import type { PrototypeItem } from '@features/ux-prototypes/logic/prototypeReceipt';
import { AvatarStack } from '@features/ux-prototypes/components/AvatarStack';
import { claimColor } from './claimPalette';

interface Props {
  item: PrototypeItem;
  people: Person[];
  assignees: string[];
  activePersonId: string;
  activeColor: string;
  onToggle: () => void;
  onShareWithEveryone: () => void;
}

function describeShare(assigneeCount: number, priceCents: number): string {
  if (assigneeCount === 0) return 'Nobody yet';
  if (assigneeCount === 1) return 'Just one person';
  return `Shared ${assigneeCount} ways · ${formatMoney(Math.round(priceCents / assigneeCount))} each`;
}

export function ClaimItemTile({
  item,
  people,
  assignees,
  activePersonId,
  activeColor,
  onToggle,
  onShareWithEveryone,
}: Props) {
  const claimedByActive = assignees.includes(activePersonId);
  const priceCents = parseCurrencyToCents(item.amountInput) ?? 0;
  const unclaimed = assignees.length === 0;

  return (
    <li
      className={cn(
        'relative overflow-hidden rounded-2xl border-2 transition-all',
        unclaimed && 'border-dashed border-neutral-300',
        !unclaimed && !claimedByActive && 'border-neutral-100 bg-neutral-50',
      )}
      style={
        claimedByActive
          ? { borderColor: activeColor, backgroundColor: `${activeColor}0f` }
          : undefined
      }
    >
      <button
        type="button"
        aria-pressed={claimedByActive}
        onClick={onToggle}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <span
          className={cn(
            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all',
            !claimedByActive && 'border-neutral-300',
          )}
          style={
            claimedByActive ? { backgroundColor: activeColor, borderColor: activeColor } : undefined
          }
        >
          {claimedByActive && (
            <span className="material-symbols-outlined text-lg text-white">check</span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="font-semibold">{item.name}</span>
            <span className="shrink-0 font-bold tabular-nums">{formatMoney(priceCents)}</span>
          </span>
          <span className="mt-1 flex items-center justify-between gap-3">
            <span className="text-xs text-neutral-500">
              {describeShare(assignees.length, priceCents)}
            </span>
            <AvatarStack
              people={people}
              personIds={assignees}
              colorFor={claimColor}
              ringClassName="ring-white"
              max={5}
            />
          </span>
        </span>
      </button>
      {unclaimed && (
        <button
          type="button"
          onClick={onShareWithEveryone}
          className="w-full border-t border-dashed border-neutral-300 py-2 text-xs font-semibold text-neutral-500"
        >
          Everyone shared this
        </button>
      )}
    </li>
  );
}
