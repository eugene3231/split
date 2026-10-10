import { cn } from '@shared/utils/cn';
import { formatCurrencyFromCents, parseCurrencyToCents } from '@shared/logic/core/money';
import type { Person } from '@shared/types';
import type { PrototypeItem } from '@features/ux-prototypes/logic/prototypeReceipt';
import { Avatar } from '@features/ux-prototypes/components/Avatar';
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
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all',
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
        <span className="flex-1">
          <span className="block font-semibold">{item.name}</span>
          <span className="block text-xs text-neutral-500">
            {unclaimed
              ? 'Nobody yet'
              : assignees.length === 1
                ? 'Just one person'
                : `Shared ${assignees.length} ways · ${formatCurrencyFromCents(Math.round(priceCents / assignees.length))} each`}
          </span>
        </span>
        <span className="flex flex-col items-end gap-1">
          <span className="font-bold tabular-nums">{formatCurrencyFromCents(priceCents)}</span>
          <span className="flex -space-x-1.5">
            {assignees.map((personId) => {
              const index = people.findIndex((person) => person.id === personId);
              return (
                <Avatar
                  key={personId}
                  name={people[index].name}
                  color={claimColor(index)}
                  className="h-5 w-5 text-[10px] ring-2 ring-white"
                />
              );
            })}
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
