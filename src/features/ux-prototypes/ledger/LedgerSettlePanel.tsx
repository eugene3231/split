import { formatCurrencyFromCents } from '@shared/logic/core/money';
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
      <p className="mt-0.5 text-xs text-ledger-muted">{payer.name} paid the bill</p>
      <ul className="mt-4 space-y-2.5">
        {others.map((person, index) => (
          <li key={person.id} className="flex items-center gap-2.5 text-sm">
            <Avatar
              name={person.name}
              color={getPersonColor(index + 1).avatarBg}
              className="h-6 w-6 text-[11px]"
            />
            <span className="flex-1">
              {person.name} <span className="text-ledger-muted">→ {payer.name}</span>
            </span>
            <span className="font-semibold tabular-nums">
              {formatCurrencyFromCents(split.totalByPersonCents[person.id])}
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
