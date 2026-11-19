import { formatCurrencyFromCents } from '@shared/logic/core/money';
import type { CurrencyCode } from '@shared/constants';
import type {
  Activity,
  Cents,
  Entry,
  Ledger,
  Member,
  MemberId,
  MyLedger,
  Transfer,
} from '@features/group-ledger/domain/types';
import { entryEffect } from '@features/group-ledger/logic/balances';
import { totalCents } from '@features/group-ledger/logic/post';

export function memberName(ledger: Ledger, id: MemberId): string {
  return ledger.members.find((member) => member.id === id)?.name ?? 'Someone';
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
      return activity.by === null ? `${what.name} was created` : `${who} created ${what.name}`;
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
  if (before.paynowMobile !== after.paynowMobile) {
    return after.paynowMobile === null
      ? `removed ${after.name}'s PayNow number`
      : `set ${after.name}'s PayNow number`;
  }
  return `updated ${after.name}`;
}

export type Direction = 'owed' | 'owes' | 'even';

export interface Worded {
  direction: Direction;
  text: string;
}

function directionOf(cents: Cents): Direction {
  return cents > 0 ? 'owed' : cents < 0 ? 'owes' : 'even';
}

/** "you're owed $42.10", "you owe $12.00" or "settled up", from a balance in group cents. */
export function describeMyBalance(cents: Cents, currency: CurrencyCode): Worded {
  const amount = formatCurrencyFromCents(Math.abs(cents), currency);
  const direction = directionOf(cents);
  const text = {
    owed: `you're owed ${amount}`,
    owes: `you owe ${amount}`,
    even: 'settled up',
  }[direction];
  return { direction, text };
}

/** "gets back $42.10", "owes $12.00" or "settled up", for anyone else's balance. */
export function describeBalance(cents: Cents, currency: CurrencyCode): Worded {
  const amount = formatCurrencyFromCents(Math.abs(cents), currency);
  const direction = directionOf(cents);
  const text = { owed: `gets back ${amount}`, owes: `owes ${amount}`, even: 'settled up' }[
    direction
  ];
  return { direction, text };
}

export interface ShareWords {
  direction: Direction;
  /** "you lent", "you owe", or "not involved". */
  label: string;
  amount: string | null;
}

/** What an entry did to this phone's member, in group currency: "you lent" $9.00. */
export function describeMyShare(entry: Entry, ledger: MyLedger): ShareWords {
  const cents = entryEffect(entry)[ledger.me] ?? 0;
  const direction = directionOf(cents);
  const transfer = entry.kind === 'transfer';
  const label = {
    owed: transfer ? 'you paid' : 'you lent',
    owes: transfer ? 'you got' : 'you owe',
    even: 'not involved',
  }[direction];
  const amount = cents === 0 ? null : formatCurrencyFromCents(Math.abs(cents), ledger.currency);
  return { direction, label, amount };
}

/** "Ben pays Ana $42.10". */
export function describeTransfer(transfer: Transfer, ledger: Ledger): string {
  const amount = formatCurrencyFromCents(transfer.cents, ledger.currency);
  return `${memberName(ledger, transfer.from)} pays ${memberName(ledger, transfer.to)} ${amount}`;
}

export function describeSettleUp(transfers: Transfer[], ledger: Ledger): string {
  if (transfers.length === 0) return `${ledger.name}: everyone is settled up.`;
  return [
    `${ledger.name}: settling up`,
    ...transfers.map((transfer) => `• ${describeTransfer(transfer, ledger)}`),
  ].join('\n');
}
