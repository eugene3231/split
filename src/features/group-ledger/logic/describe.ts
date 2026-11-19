import { formatCurrencyFromCents } from '@shared/logic/core/money';
import type {
  Activity,
  Entry,
  Ledger,
  Member,
  MemberId,
} from '@features/group-ledger/domain/types';
import { totalCents } from '@features/group-ledger/logic/post';

/** A member's name as it reads now, following a merge. */
export function memberName(ledger: Ledger, id: MemberId): string {
  const current = ledger.aliases.get(id) ?? id;
  return ledger.members.find((member) => member.id === current)?.name ?? 'Someone';
}

/** "Grab · $18.00" for an expense, "Ben paid Ana · $18.00" for a transfer. */
export function describeEntry(entry: Entry, ledger: Ledger): string {
  if (entry.kind === 'transfer') {
    const amount = formatCurrencyFromCents(entry.cents, ledger.currency);
    return `${memberName(ledger, entry.from)} paid ${memberName(ledger, entry.to)} · ${amount}`;
  }
  const title = entry.title.trim() || 'Untitled expense';
  return `${title} · ${formatCurrencyFromCents(totalCents(entry), entry.currency)}`;
}

/** One line for the activity list, such as "Ben added Grab · $18.00". */
export function describeActivity(activity: Activity, ledger: Ledger): string {
  const { what } = activity;
  const who = activity.by === null ? 'Someone' : memberName(ledger, activity.by);

  switch (what.kind) {
    case 'group-created':
      return `${who} created ${what.name}`;
    case 'group-renamed':
      return `${who} renamed the group to ${what.to}`;
    case 'member-added':
      return `${who} added ${what.member.name}`;
    case 'member-changed':
      return `${who} ${describeMemberChange(what.before, what.after)}`;
    case 'member-merged':
      return `${who} merged ${what.from.name} into ${what.into.name}`;
    case 'member-claimed':
      return what.member === null ? `${who} stepped back` : `${what.member.name} joined`;
    case 'entry-added':
      return `${who} added ${describeEntry(what.entry, ledger)}`;
    case 'entry-changed':
      return `${who} changed ${describeEntry(what.after, ledger)}`;
    case 'entry-removed':
      return `${who} removed ${describeEntry(what.entry, ledger)}`;
    case 'entry-restored':
      return `${who} restored ${describeEntry(what.entry, ledger)}`;
    case 'unknown':
      return 'Update Split to see this change';
    default:
      return what satisfies never;
  }
}

function describeMemberChange(before: Member, after: Member): string {
  if (before.name !== after.name) return `renamed ${before.name} to ${after.name}`;
  if (before.archived !== after.archived) {
    return `${after.archived ? 'archived' : 'brought back'} ${after.name}`;
  }
  return `updated ${after.name}`;
}
