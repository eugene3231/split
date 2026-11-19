import fc from 'fast-check';
import type { CurrencyCode } from '@shared/constants';
import type {
  Change,
  ConfirmedOp,
  Entry,
  ExpenseEntry,
  GroupLog,
  Ledger,
  Member,
  MemberId,
  PendingOp,
  TransferEntry,
  UserId,
} from '@features/group-ledger/domain/types';
import { foldLedger } from './fold';
import {
  asEntryId,
  asGroupId,
  asInviteCode,
  asLocalDate,
  asMemberId,
  asOpId,
  asUserId,
} from './ids';
import { postAmounts } from './post';

export const ana = asMemberId('ana');
export const ben = asMemberId('ben');
export const cat = asMemberId('cat');
export const dan = asMemberId('dan');

export const anaPhone = asUserId('user-ana');
export const benPhone = asUserId('user-ben');

export function makeMember(id: MemberId, overrides: Partial<Member> = {}): Member {
  return {
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    paynowMobile: null,
    archived: false,
    ...overrides,
  };
}

interface ExpenseOptions {
  title?: string;
  date?: string;
  currency?: CurrencyCode;
  rate?: number;
  payer?: MemberId;
  others?: Record<MemberId, number>;
}

export function makeExpense(
  id: string,
  owed: Record<MemberId, number>,
  options: ExpenseOptions = {},
): ExpenseEntry {
  const entry = postAmounts(
    {
      id: asEntryId(id),
      title: options.title ?? id,
      date: asLocalDate(options.date ?? '2026-11-19'),
      currency: options.currency ?? 'SGD',
      rate: options.rate ?? 1,
      payment: { payer: options.payer ?? ana, others: options.others ?? {} },
    },
    owed,
  );
  if (entry === null) throw new Error('makeExpense needs somebody to owe something');
  return entry;
}

export function makeTransfer(
  id: string,
  from: MemberId,
  to: MemberId,
  cents: number,
  date = '2026-11-19',
): TransferEntry {
  return { kind: 'transfer', id: asEntryId(id), date: asLocalDate(date), from, to, cents };
}

export function confirmed(seq: number, change: Change | null, userId = anaPhone): ConfirmedOp {
  return { id: asOpId(`c${seq}`), seq, at: `2026-11-19T10:00:${pad(seq)}Z`, change, userId };
}

export function pending(order: number, change: Change): PendingOp {
  return { id: asOpId(`p${order}`), order, at: `2026-11-19T11:00:${pad(order)}Z`, change };
}

export function makeLog(confirmedOps: ConfirmedOp[], pendingOps: PendingOp[] = []): GroupLog {
  return {
    groupId: asGroupId('group-1'),
    inviteCode: asInviteCode('invite-code'),
    confirmed: confirmedOps,
    pending: pendingOps,
  };
}

export function logOf(...changes: Array<Change | null>): GroupLog {
  return makeLog(changes.map((change, index) => confirmed(index + 1, change)));
}

export const created: Change = { kind: 'group.created', name: 'Japan 2026', currency: 'SGD' };

export function put(member: Member): Change {
  return { kind: 'member.put', member };
}

export function fold(log: GroupLog, self: UserId | null = anaPhone): Ledger {
  const ledger = foldLedger(log, self);
  if (ledger === null) throw new Error('the log never creates its group');
  return ledger;
}

const pad = (value: number) => String(value).padStart(2, '0');

const MEMBER_POOL = ['m0', 'm1', 'm2', 'm3'].map(asMemberId);
const USER_POOL = ['u0', 'u1', 'u2'].map(asUserId);
const ENTRY_POOL = ['e0', 'e1', 'e2'];

export const memberIdArb = fc.constantFrom(...MEMBER_POOL);
export const userIdArb = fc.constantFrom(...USER_POOL);

const dateArb = fc.constantFrom('2026-11-17', '2026-11-18', '2026-11-19');

export const expenseArb: fc.Arbitrary<ExpenseEntry> = fc
  .record({
    id: fc.constantFrom(...ENTRY_POOL),
    owed: fc.dictionary(memberIdArb, fc.integer({ min: 1, max: 500_000 }), { minKeys: 1 }),
    payer: memberIdArb,
    others: fc.dictionary(memberIdArb, fc.integer({ min: 1, max: 500_000 })),
    rate: fc.oneof(fc.constant(1), fc.double({ min: 0.00005, max: 2, noNaN: true })),
    currency: fc.constantFrom<CurrencyCode>('SGD', 'JPY', 'IDR', 'USD'),
    date: dateArb,
  })
  .map(({ id, owed, others, ...options }) => {
    const rest = Object.fromEntries(
      Object.entries(others).filter(([memberId]) => memberId !== options.payer),
    );
    return makeExpense(id, owed, { ...options, others: rest });
  });

export const transferArb: fc.Arbitrary<TransferEntry> = fc
  .record({
    id: fc.constantFrom(...ENTRY_POOL),
    from: memberIdArb,
    to: memberIdArb,
    cents: fc.integer({ min: 1, max: 500_000 }),
    date: dateArb,
  })
  .map(({ id, from, to, cents, date }) => makeTransfer(id, from, to, cents, date));

export const entryArb: fc.Arbitrary<Entry> = fc.oneof(expenseArb, transferArb);

export function changeArb(earlierOps: number): fc.Arbitrary<Change> {
  const opIdArb = fc.integer({ min: 0, max: Math.max(earlierOps, 1) }).map((n) => asOpId(`c${n}`));
  return fc.oneof(
    fc.record({ kind: fc.constant('group.renamed' as const), name: fc.constantFrom('A', 'B') }),
    fc.record({
      kind: fc.constant('member.put' as const),
      member: fc.record({
        id: memberIdArb,
        name: fc.constantFrom('Ana', 'Ben', 'ana '),
        paynowMobile: fc.constant(null),
        archived: fc.boolean(),
      }),
    }),
    fc.record({
      kind: fc.constant('member.merged' as const),
      from: memberIdArb,
      into: memberIdArb,
    }),
    fc.record({
      kind: fc.constant('member.claimed' as const),
      memberId: fc.option(memberIdArb, { nil: null }),
    }),
    fc.record({
      kind: fc.constant('entry.put' as const),
      entry: entryArb,
      base: fc.option(opIdArb, { nil: null }),
    }),
    fc.record({
      kind: fc.constant('entry.removed' as const),
      entryId: fc.constantFrom(...ENTRY_POOL).map(asEntryId),
      base: opIdArb,
    }),
  );
}

export const confirmedOpsArb: fc.Arbitrary<ConfirmedOp[]> = fc
  .integer({ min: 0, max: 25 })
  .chain((length) =>
    fc.tuple(
      ...Array.from({ length }, (_, index) =>
        fc.tuple(fc.option(changeArb(index + 1), { nil: null, freq: 12 }), userIdArb),
      ),
    ),
  )
  .map((rest) => [
    confirmed(1, created, USER_POOL[0]),
    ...rest.map(([change, userId], index) => confirmed(index + 2, change, userId)),
  ]);

export const pendingChangesArb: fc.Arbitrary<Change[]> = fc.array(changeArb(25), { maxLength: 6 });
