import type { LocalDate, PostedEntry } from '@features/group-ledger/domain/types';
import type { ReadyGroup } from '@features/group-ledger/hooks/useGroup';
import { dateLabel } from '@features/group-ledger/logic/dates';
import { describeMyShare, memberName } from '@features/group-ledger/logic/describe';
import { DIRECTION_TEXT } from '@features/group-ledger/components/ui/classes';
import { todayLocalDate } from '@features/group-ledger/logic/ids';
import { totalCents } from '@features/group-ledger/logic/post';
import { Icon } from '@features/group-ledger/components/ui/IconButton';
import { MemberAvatar } from '@features/group-ledger/components/ui/MemberAvatar';
import { Link, type Route } from '@shared/routing';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { cn } from '@shared/utils/cn';

/** Every live entry, newest day first, each day under its own heading. */
export function EntryList({ group }: { group: ReadyGroup }) {
  const days = new Map<LocalDate, PostedEntry[]>();
  for (const posted of group.ledger.entries) {
    days.set(posted.entry.date, [...(days.get(posted.entry.date) ?? []), posted]);
  }
  const today = todayLocalDate();

  return (
    <div className="space-y-5">
      {[...days].map(([date, entries]) => (
        <section key={date} aria-label={dateLabel(date, today)}>
          <h3 className="mb-2 px-1 section-label">{dateLabel(date, today)}</h3>
          <ul className="divide-y divide-surface-container-highest surface-card">
            {entries.map((posted) => (
              <li key={posted.entry.id}>
                <EntryRow group={group} posted={posted} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function EntryRow({ group, posted }: { group: ReadyGroup; posted: PostedEntry }) {
  const { ledger } = group;
  const { entry } = posted;
  const groupId = ledger.groupId;
  const share = describeMyShare(entry, ledger, ledger.me);

  let to: Route;
  let title: string;
  let detail: string;
  let avatar = (
    <MemberAvatar
      ledger={ledger}
      memberId={entry.kind === 'transfer' ? entry.from : entry.payment.payer}
    />
  );
  if (entry.kind === 'transfer') {
    to = { kind: 'editExpense', groupId, entryId: entry.id };
    title = `${memberName(ledger, entry.from)} paid ${memberName(ledger, entry.to)}`;
    detail = formatCurrencyFromCents(entry.cents, ledger.currency);
    avatar = (
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
        <Icon name="payments" className="text-xl" />
      </span>
    );
  } else {
    to =
      entry.basis.kind === 'receipt'
        ? { kind: 'receipt', groupId, entryId: entry.id }
        : { kind: 'editExpense', groupId, entryId: entry.id };
    title = entry.title || 'Untitled expense';
    const payers = Object.keys(entry.payment.others).length;
    const amount = formatCurrencyFromCents(totalCents(entry), entry.currency);
    detail =
      payers === 0
        ? `${memberName(ledger, entry.payment.payer)} paid ${amount}`
        : `${payers + 1} people paid ${amount}`;
  }

  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-container-low"
    >
      {avatar}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-semibold text-on-surface">
          <span className="truncate">{title}</span>
          {entry.kind === 'expense' && entry.basis.kind === 'receipt' && (
            <Icon name="receipt_long" className="text-base text-outline" />
          )}
          {posted.pending && (
            <span title="Waiting to sync" className="flex">
              <Icon name="cloud_upload" className="text-base text-outline" />
              <span className="sr-only">Waiting to sync</span>
            </span>
          )}
        </span>
        <span className="block truncate text-sm text-on-surface-variant">{detail}</span>
      </span>
      <span
        className={cn('shrink-0 text-right text-xs leading-tight', DIRECTION_TEXT[share.direction])}
      >
        <span className="block">{share.label}</span>
        {share.amount && (
          <span className="block text-[0.9375rem] font-semibold tabular-nums">{share.amount}</span>
        )}
      </span>
    </Link>
  );
}
