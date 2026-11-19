import { currencyInfo, type CurrencyCode } from '@shared/constants';
import {
  formatCurrencyFromCents,
  formatExchangeRate,
  formatMoneyAmount,
  parseCurrencyToCents,
  parseNumber,
} from '@shared/logic/core/money';
import type {
  Cents,
  Entry,
  EntryId,
  ExpenseEntry,
  LocalDate,
  Member,
  MemberId,
  Payment,
} from '@features/group-ledger/domain/types';
import { asOpId, memberIdsOf } from '@features/group-ledger/logic/ids';
import { fitsOnServer } from '@features/group-ledger/backend/limits';
import { paidBy, postAmounts, postWeights, totalCents } from '@features/group-ledger/logic/post';

export type PaidBy =
  { kind: 'one'; payer: MemberId } | { kind: 'several'; amounts: Record<MemberId, string> };

export type SplitBy =
  | { kind: 'evenly'; between: MemberId[] }
  | { kind: 'shares'; weights: Record<MemberId, number> }
  | { kind: 'amounts'; amounts: Record<MemberId, string> };

export interface ExpenseDraft {
  amount: string;
  title: string;
  date: LocalDate;
  currency: CurrencyCode;
  /** Group-currency units per one unit of `currency`, as typed. Read only in another currency. */
  rate: string;
  paidBy: PaidBy;
  splitBy: SplitBy;
}

export type ExpenseCheck = { ok: true; entry: ExpenseEntry } | { ok: false; reason: string };

/** A blank expense paid by `payer` and split evenly between every member not archived. */
export function blankDraft(
  members: Member[],
  payer: MemberId,
  currency: CurrencyCode,
  date: LocalDate,
): ExpenseDraft {
  return {
    amount: '',
    title: '',
    date,
    currency,
    rate: '1',
    paidBy: { kind: 'one', payer },
    splitBy: { kind: 'evenly', between: liveIds(members) },
  };
}

export function draftFromEntry(entry: ExpenseEntry): ExpenseDraft {
  const { currency, basis } = entry;
  const typed = (cents: Cents) => formatMoneyAmount(cents, currency);
  const others = memberIdsOf(entry.payment.others);
  let splitBy: SplitBy;
  if (basis.kind === 'weights') {
    const weights = Object.values(basis.weights);
    splitBy = weights.every((weight) => weight === 1)
      ? { kind: 'evenly', between: memberIdsOf(basis.weights) }
      : { kind: 'shares', weights: basis.weights };
  } else {
    splitBy = { kind: 'amounts', amounts: mapValues(entry.owed, typed) };
  }
  return {
    amount: typed(totalCents(entry)),
    title: entry.title,
    date: entry.date,
    currency,
    rate: String(entry.rate),
    paidBy:
      others.length === 0
        ? { kind: 'one', payer: entry.payment.payer }
        : { kind: 'several', amounts: mapValues(paidBy(entry), typed) },
    splitBy,
  };
}

/**
 * Group-currency units per one unit of `currency`, from rates kept against the base currency. A
 * rate typed on a receipt (`override`, base units per unit) wins over the live one.
 */
export function groupRate(
  currency: CurrencyCode,
  groupCurrency: CurrencyCode,
  rates: Record<string, number>,
  override: number | null = null,
): number {
  if (currency === groupCurrency) return 1;
  const inBase = (code: CurrencyCode) => rates[code] ?? currencyInfo(code).fallbackRate;
  const own = override !== null && override > 0 ? override : inBase(currency);
  return own / inBase(groupCurrency);
}

export function rateInput(
  currency: CurrencyCode,
  groupCurrency: CurrencyCode,
  rates: Record<string, number>,
): string {
  return formatExchangeRate(groupRate(currency, groupCurrency, rates));
}

/** What the typed amounts still need to reach the total: positive is short, negative is over. */
export function amountsLeft(total: string, amounts: Record<MemberId, string>): Cents {
  return (parseCurrencyToCents(total) ?? 0) - sumTyped(amounts);
}

export function checkExpense(
  draft: ExpenseDraft,
  id: EntryId,
  groupCurrency: CurrencyCode,
): ExpenseCheck {
  const total = parseCurrencyToCents(draft.amount);
  if (total === null || total <= 0) return fail('Enter an amount');
  if (draft.title.trim() === '') return fail('Say what it was for');

  const rate = draft.currency === groupCurrency ? 1 : parseNumber(draft.rate);
  if (rate === null || rate <= 0) return fail('Enter the exchange rate');

  const payment = paymentOf(draft, total);
  if ('reason' in payment) return payment;

  const header = {
    id,
    title: draft.title.trim(),
    date: draft.date,
    currency: draft.currency,
    rate,
    payment,
  };
  const money = (cents: Cents) => formatCurrencyFromCents(Math.abs(cents), draft.currency);
  const { splitBy } = draft;
  switch (splitBy.kind) {
    case 'evenly': {
      const weights = Object.fromEntries(splitBy.between.map((member) => [member, 1]));
      return built(postWeights(header, total, weights), 'Pick who to split it between');
    }
    case 'shares':
      return built(postWeights(header, total, splitBy.weights), 'Give someone a share');
    case 'amounts': {
      const left = total - sumTyped(splitBy.amounts);
      if (left > 0) return fail(`${money(left)} left to split`);
      if (left < 0) return fail(`Split ${money(left)} too much`);
      return built(postAmounts(header, mapValues(splitBy.amounts, toCents)), 'Enter the amounts');
    }
  }
}

function paymentOf(draft: ExpenseDraft, total: Cents): Payment | { ok: false; reason: string } {
  const { paidBy: paid } = draft;
  if (paid.kind === 'one') return { payer: paid.payer, others: {} };
  const typed = memberIdsOf(paid.amounts)
    .map((member) => ({ member, cents: toCents(paid.amounts[member]) }))
    .filter(({ cents }) => cents > 0)
    .sort((a, b) => b.cents - a.cents);
  const paidTotal = typed.reduce((sum, { cents }) => sum + cents, 0);
  if (typed.length === 0) return fail('Enter who paid what');
  if (paidTotal !== total) {
    const gap = formatCurrencyFromCents(Math.abs(total - paidTotal), draft.currency);
    return fail(paidTotal < total ? `${gap} still unpaid` : `Paid ${gap} too much`);
  }
  const [payer, ...others] = typed;
  return {
    payer: payer.member,
    others: Object.fromEntries(others.map(({ member, cents }) => [member, cents])),
  };
}

function built(entry: ExpenseEntry | null, reason: string): ExpenseCheck {
  if (entry === null) return fail(reason);
  return entryFits(entry) ? { ok: true, entry } : fail(TOO_BIG);
}

export const TOO_BIG = 'Too big to sync. Split it into smaller expenses';

/** Stands in for the revision an edit is based on, which is always a UUID this long. */
const ANY_BASE = asOpId('00000000-0000-4000-8000-000000000000');

/**
 * Whether the server will take the entry, new or as an edit. One that does not fit would be
 * dropped after saving.
 */
export function entryFits(entry: Entry): boolean {
  return fitsOnServer({ kind: 'entry.put', entry, base: ANY_BASE });
}

function fail(reason: string): { ok: false; reason: string } {
  return { ok: false, reason };
}

function liveIds(members: Member[]): MemberId[] {
  return members.filter((member) => !member.archived).map((member) => member.id);
}

function toCents(input: string | undefined): Cents {
  return Math.max(parseCurrencyToCents(input ?? '') ?? 0, 0);
}

function sumTyped(amounts: Record<MemberId, string>): Cents {
  return Object.values(amounts).reduce((sum, input) => sum + toCents(input), 0);
}

function mapValues<T, U>(record: Record<MemberId, T>, map: (value: T) => U): Record<MemberId, U> {
  return Object.fromEntries(memberIdsOf(record).map((id) => [id, map(record[id])]));
}

/** Members the form offers: everyone not archived, and anyone archived the draft already names. */
export function formMembers(members: Member[], draft: ExpenseDraft): Member[] {
  const named = new Set<MemberId>([
    ...(draft.paidBy.kind === 'one' ? [draft.paidBy.payer] : memberIdsOf(draft.paidBy.amounts)),
    ...(draft.splitBy.kind === 'evenly'
      ? draft.splitBy.between
      : memberIdsOf(
          draft.splitBy.kind === 'shares' ? draft.splitBy.weights : draft.splitBy.amounts,
        )),
  ]);
  return members.filter((member) => !member.archived || named.has(member.id));
}

export function changeSplitKind(splitBy: SplitBy, kind: SplitBy['kind']): SplitBy {
  if (splitBy.kind === kind) return splitBy;
  const included =
    splitBy.kind === 'evenly'
      ? splitBy.between
      : splitBy.kind === 'shares'
        ? memberIdsOf(splitBy.weights).filter((id) => splitBy.weights[id] > 0)
        : memberIdsOf(splitBy.amounts).filter((id) => toCents(splitBy.amounts[id]) > 0);
  switch (kind) {
    case 'evenly':
      return { kind, between: included };
    case 'shares':
      return { kind, weights: Object.fromEntries(included.map((id) => [id, 1])) };
    case 'amounts':
      return { kind, amounts: Object.fromEntries(included.map((id) => [id, ''])) };
  }
}

/** Between one payer and several: the payer keeps the whole amount, or whoever paid most pays. */
export function changePaidBy(draft: ExpenseDraft, several: boolean): PaidBy {
  const { paidBy: paid } = draft;
  if (several && paid.kind === 'one') {
    return { kind: 'several', amounts: { [paid.payer]: draft.amount } };
  }
  if (!several && paid.kind === 'several') {
    const [top] = memberIdsOf(paid.amounts).sort(
      (a, b) => toCents(paid.amounts[b]) - toCents(paid.amounts[a]),
    );
    if (top !== undefined) return { kind: 'one', payer: top };
  }
  return paid;
}
