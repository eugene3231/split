import { formatMoney } from '@features/ux-prototypes/logic/prototypeFormat';
import { getPersonColor } from '@shared/utils/personColors';
import type { Person, SplitResult } from '@shared/types';
import { Avatar } from '@features/ux-prototypes/components/Avatar';

interface Props {
  people: Person[];
  split: SplitResult;
}

export function LedgerSettlePanel({ people, split }: Props) {
  const [payer, ...others] = people;

  return (
    <aside className="h-fit rounded-xl border border-ledger-line bg-ledger-panel p-4">
      <h2 className="text-sm font-semibold">Settle up</h2>
      <p className="mt-0.5 text-xs text-ledger-muted">
        Everyone pays <span className="font-medium text-ledger-ink">{payer.name}</span>
      </p>
      <ul className="mt-4 space-y-2.5">
        {others.map((person, index) => (
          <li key={person.id} className="flex items-center gap-2.5 text-sm">
            <Avatar
              name={person.name}
              color={getPersonColor(index + 1).avatarBg}
              className="h-6 w-6 text-[11px]"
            />
            <span className="min-w-0 flex-1 truncate" title={person.name}>
              {person.name}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">
              {formatMoney(split.totalByPersonCents[person.id])}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-medium">
        <button type="button" className="rounded-md bg-ledger-ink py-2 text-white">
          Copy as text
        </button>
        <button type="button" className="rounded-md border border-ledger-line py-2">
          PayNow QR
        </button>
      </div>
      <p className="mt-3 text-[11px] text-ledger-muted">
        Click any cell to add or remove someone. Amounts split evenly across everyone on a row.
      </p>
    </aside>
  );
}
