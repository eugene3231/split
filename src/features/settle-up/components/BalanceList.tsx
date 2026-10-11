import { PersonAvatar } from '@features/split-workspace/components/shared/PersonAvatar';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import type { Person } from '@shared/types';
import { cn } from '@shared/utils/cn';
import type { PersonBalance } from '../logic/settleUp';

interface BalanceListProps {
  people: Person[];
  balances: PersonBalance[];
}

export function BalanceList({ people, balances }: BalanceListProps) {
  return (
    <ul className="divide-y divide-outline-variant/40 rounded-2xl bg-surface-container-lowest shadow-sm">
      {balances.map((balance) => {
        const index = people.findIndex((p) => p.id === balance.personId);
        const person = people[index];
        return (
          <li key={balance.personId} className="flex items-center gap-3 px-4 py-3">
            <PersonAvatar name={person.name} colorIndex={index} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-on-surface">{person.name}</p>
              <p className="text-xs text-on-surface-variant">
                Paid {formatCurrencyFromCents(balance.paidCents)} · Share{' '}
                {formatCurrencyFromCents(balance.owedCents)}
              </p>
            </div>
            <NetBadge netCents={balance.netCents} />
          </li>
        );
      })}
    </ul>
  );
}

function NetBadge({ netCents }: { netCents: number }) {
  if (netCents === 0) {
    return <span className="text-sm font-semibold text-on-surface-variant">Square</span>;
  }
  const getsBack = netCents > 0;
  return (
    <span
      className={cn(
        'rounded-full px-3 py-1 text-sm font-bold',
        getsBack
          ? 'bg-secondary-container text-on-secondary-container'
          : 'bg-error-container text-on-error-container',
      )}
    >
      {getsBack ? 'Gets back ' : 'Owes '}
      {formatCurrencyFromCents(Math.abs(netCents))}
    </span>
  );
}
