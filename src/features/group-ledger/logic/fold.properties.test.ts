/**
 * What the ledger fold promises for every log, checked on the real `foldLedger`,
 * `computeBalances` and `settleUp` over generated logs. The ledger-model skill
 * (.agents/skills/ledger-model/SKILL.md) says how to run it, read a failure, and keep it true to
 * the code. `pnpm formal:ledger` runs it with LEDGER_RUNS=10000.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type {
  Activity,
  Change,
  ConfirmedOp,
  Entry,
  ExpenseEntry,
  GroupLog,
  Ledger,
  MemberId,
  OpId,
  PendingOp,
  UserId,
} from '@features/group-ledger/domain/types';
import { computeBalances } from './balances';
import { describeActivity } from './describe';
import { foldLedger } from './fold';
import { asEntryId, asMemberId, asUserId, memberIdsOf } from './ids';
import { paidBy, totalCents } from './post';
import { settleUp } from './settleUp';
import {
  changeArb,
  confirmed,
  confirmedOpsArb,
  created,
  entryArb,
  makeExpense,
  makeLog,
  makeMember,
} from './testHelpers';

const RUNS = Number(import.meta.env.LEDGER_RUNS ?? 100);
const runs = { numRuns: RUNS };

const PHONES = ['u0', 'u1', 'u2'].map(asUserId);
const MEMBERS = ['m0', 'm1', 'm2', 'm3'].map(asMemberId);

// ---------------------------------------------------------------------------------------------
// Logs as phones write them. Each step is one GroupActions call (sync/groupActions.ts) made on a
// phone that has pulled only part of the log and still holds its own later ops as pending, so
// `base` is whatever that phone had on screen. That is how two phones end up changing one entry
// apart from each other. A `raw` step is any change at all, to reach what no screen sends.
// ---------------------------------------------------------------------------------------------

type Intent =
  | { kind: 'add'; entry: Entry; id: number }
  | { kind: 'edit'; pick: number; entry: Entry }
  | { kind: 'remove'; pick: number }
  | { kind: 'undo'; pick: number }
  | { kind: 'restore'; pick: number }
  | { kind: 'raw'; change: Change };

interface Step {
  phone: UserId;
  /** How much of the log the phone had pulled, in hundredths. */
  seen: number;
  intent: Intent;
}

/**
 * An entry as the expense form posts it: what `others` put in never comes to more than the total
 * (`expenseForm.ts` refuses "Paid too much"), so every one of them is paid in full.
 */
const formEntryArb: fc.Arbitrary<Entry> = entryArb.map((entry) => {
  if (entry.kind === 'transfer') return entry;
  const others = paidBy(entry);
  delete others[entry.payment.payer];
  return { ...entry, payment: { payer: entry.payment.payer, others } };
});

const pick = fc.nat({ max: 20 });
const intentArb: fc.Arbitrary<Intent> = fc.oneof(
  {
    weight: 3,
    arbitrary: fc.record({
      kind: fc.constant('add' as const),
      entry: formEntryArb,
      id: fc.nat({ max: 3 }),
    }),
  },
  {
    weight: 4,
    arbitrary: fc.record({ kind: fc.constant('edit' as const), pick, entry: formEntryArb }),
  },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant('remove' as const), pick }) },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant('undo' as const), pick }) },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant('restore' as const), pick }) },
  { weight: 3, arbitrary: fc.record({ kind: fc.constant('raw' as const), change: changeArb(30) }) },
);

const stepArb: fc.Arbitrary<Step> = fc.record({
  phone: fc.constantFrom(...PHONES),
  seen: fc.oneof(fc.constant(100), fc.integer({ min: 0, max: 100 })),
  intent: intentArb,
});

/** What `phone` shows when it has pulled `pulled` ops and still holds its own later ones. */
function phoneView(ops: ConfirmedOp[], pulled: number, phone: UserId): Ledger {
  const own: PendingOp[] = ops
    .slice(pulled)
    .filter((op) => op.userId === phone && op.change !== null)
    .map((op) => ({ id: op.id, order: op.seq, at: op.at, change: op.change! }));
  return foldLedger(makeLog(ops.slice(0, pulled), own), phone)!;
}

function intentChange(view: Ledger, intent: Intent, seq: number): Change | null {
  const at = <T>(items: T[], index: number): T | undefined => items[index % items.length];
  switch (intent.kind) {
    case 'add':
      return {
        kind: 'entry.put',
        entry: { ...intent.entry, id: asEntryId(`n${seq}-${intent.id}`) },
        base: null,
      };
    case 'edit': {
      const head = at(view.entries, intent.pick);
      if (head === undefined) return null;
      return { kind: 'entry.put', entry: { ...intent.entry, id: head.entry.id }, base: head.rev };
    }
    case 'remove': {
      const head = at(view.entries, intent.pick);
      if (head === undefined) return null;
      return { kind: 'entry.removed', entryId: head.entry.id, base: head.rev };
    }
    case 'undo':
      return (
        at(
          view.activity.filter((row) => row.undo !== null),
          intent.pick,
        )?.undo ?? null
      );
    case 'restore': {
      const row = at(
        view.activity.filter((row) => row.replaced !== null),
        intent.pick,
      );
      return row === undefined ? null : restoreOf(view, row);
    }
    case 'raw':
      return intent.change;
    default:
      return intent satisfies never;
  }
}

/** The Restore button on a replaced row, as ActivityScreen sends it. */
function restoreOf(ledger: Ledger, row: Activity): Change {
  const replaced = row.replaced!;
  const head = ledger.entries.find((posted) => posted.entry.id === replaced.id);
  return { kind: 'entry.put', entry: replaced, base: head?.rev ?? row.opId };
}

function writeLog(members: MemberId[], steps: Step[]): ConfirmedOp[] {
  const ops = [
    confirmed(1, created, PHONES[0]),
    ...members.map((id, index) =>
      confirmed(index + 2, { kind: 'member.put', member: makeMember(id) }, PHONES[0]),
    ),
  ];
  for (const { phone, seen, intent } of steps) {
    const pulled = Math.max(1, Math.round((ops.length * seen) / 100));
    const change = intentChange(phoneView(ops, pulled, phone), intent, ops.length + 1);
    if (change !== null) ops.push(confirmed(ops.length + 1, change, phone));
  }
  return ops;
}

const phoneLogArb: fc.Arbitrary<ConfirmedOp[]> = fc
  .tuple(fc.subarray(MEMBERS, { minLength: 2 }), fc.array(stepArb, { maxLength: 24, size: 'max' }))
  .map(([members, steps]) => writeLog(members, steps));

/** Logs phones write, and logs of any change at all. */
const logArb = fc.oneof(
  { weight: 3, arbitrary: phoneLogArb },
  { weight: 1, arbitrary: confirmedOpsArb },
);

// ---------------------------------------------------------------------------------------------

const ledgerOf = (ops: ConfirmedOp[], phone: UserId = PHONES[0]) =>
  foldLedger(makeLog(ops), phone)!;
const append = (ops: ConfirmedOp[], change: Change, phone: UserId) => [
  ...ops,
  confirmed(ops.length + 1, change, phone),
];
const liveEntry = (ledger: Ledger, id: Entry['id']) =>
  ledger.entries.find((posted) => posted.entry.id === id)?.entry;
const rowOf = (ledger: Ledger, opId: OpId) => ledger.activity.find((row) => row.opId === opId);
/** Nobody in `others` put in more than was left to pay, as on every entry the form posts. */
const paidInFull = (entry: ExpenseEntry) =>
  sum(Object.values(entry.payment.others)) <= totalCents(entry);
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** Everything a phone shows except who it is itself. */
function shared(ledger: Ledger) {
  return {
    ...ledger,
    me: 'differs by phone',
    balances: computeBalances(ledger),
    settle: settleUp(computeBalances(ledger)),
    wording: ledger.activity.map((row) => describeActivity(row, ledger)),
  };
}

function withoutPendingFlags(ledger: Ledger) {
  return {
    ...ledger,
    entries: ledger.entries.map((posted) => ({ ...posted, pending: false })),
    activity: ledger.activity.map((row) => ({ ...row, pending: false })),
  };
}

describe('ledger fold properties', () => {
  it('shows the same ledger, balances and activity on every phone holding the same confirmed log', () => {
    fc.assert(
      fc.property(
        logArb.chain((ops) =>
          fc.tuple(fc.constant(ops), fc.shuffledSubarray(ops, { minLength: ops.length })),
        ),
        fc.constantFrom(...PHONES),
        fc.constantFrom(...PHONES, null),
        ([ops, held], one, other) => {
          expect(shared(foldLedger(makeLog(held), other)!)).toEqual(
            shared(foldLedger(makeLog(ops), one)!),
          );
        },
      ),
      runs,
    );
  });

  it('shows offline what it will show once the server takes those changes, if nobody else wrote', () => {
    fc.assert(
      fc.property(logArb, fc.nat(), fc.constantFrom(...PHONES), (ops, cut, phone) => {
        const synced = 1 + (cut % ops.length);
        const mine = ops.slice(synced).filter((op) => op.change !== null);
        const offline: GroupLog = makeLog(
          ops.slice(0, synced),
          mine.map((op, order) => ({ id: op.id, order, at: op.at, change: op.change! })),
        );
        const taken = [
          ...ops.slice(0, synced),
          ...mine.map((op, index) => ({ ...op, seq: synced + index + 1, userId: phone })),
        ];

        expect(withoutPendingFlags(foldLedger(offline, phone)!)).toEqual(
          withoutPendingFlags(ledgerOf(taken, phone)),
        );
      }),
      runs,
    );
  });

  it('keeps every balance adding up to zero, and settling up brings everyone to zero', () => {
    fc.assert(
      fc.property(logArb, (ops) => {
        const balances = computeBalances(ledgerOf(ops));
        expect(sum(Object.values(balances))).toBe(0);

        const after = { ...balances };
        for (const { from, to, cents } of settleUp(balances)) {
          expect(cents).toBeGreaterThan(0);
          after[from] += cents;
          after[to] -= cents;
        }
        expect(Object.values(after).every((cents) => cents === 0)).toBe(true);
      }),
      runs,
    );
  });

  it('never loses an edit silently: an op over a version its author never saw is flagged, and Restore brings that version back', () => {
    fc.assert(
      fc.property(logArb, (ops) => {
        /** The last op that wrote each entry: a put, or a remove of a live entry. */
        const lastWrite = new Map<string, { op: OpId; removed: boolean }>();
        ops.forEach((op, index) => {
          const change = op.change;
          if (change?.kind !== 'entry.put' && change?.kind !== 'entry.removed') return;
          const id = change.kind === 'entry.put' ? change.entry.id : change.entryId;
          const before = lastWrite.get(id);
          if (change.kind === 'entry.removed' && (before === undefined || before.removed)) return;
          lastWrite.set(id, { op: op.id, removed: change.kind === 'entry.removed' });

          const prior = ledgerOf(ops.slice(0, index));
          const now = ledgerOf(ops.slice(0, index + 1));
          const row = rowOf(now, op.id)!;
          if (before === undefined || change.base === before.op) {
            expect(row.replaced).toBeNull();
            return;
          }

          const unseen = before.removed
            ? (rowOf(prior, before.op)!.what as { entry: Entry }).entry
            : liveEntry(prior, asEntryId(id));
          expect(row.replaced).toEqual(unseen);

          const restored = ledgerOf(
            append(ops.slice(0, index + 1), restoreOf(now, row), op.userId),
          );
          expect(liveEntry(restored, asEntryId(id))).toEqual(unseen);
          expect(restored.activity[0].replaced).toBeNull();
        });
      }),
      runs,
    );
  });

  it('puts the ledger back as it was when the undo of the op just written is applied', () => {
    fc.assert(
      fc.property(logArb, (ops) => {
        ops.forEach((op, index) => {
          if (index === 0) return;
          const prior = ledgerOf(ops.slice(0, index));
          const row = rowOf(ledgerOf(ops.slice(0, index + 1)), op.id);
          if (row?.undo == null) return;

          const undone = ledgerOf(append(ops.slice(0, index + 1), row.undo, op.userId));
          expect(undone.name).toBe(prior.name);
          expect(undone.members).toEqual(prior.members);
          expect(undone.entries.map((posted) => posted.entry)).toEqual(
            prior.entries.map((posted) => posted.entry),
          );
        });
      }),
      runs,
    );
  });

  it("moves only the merged member's balance into the member it joins when every entry is in the group's currency", () => {
    fc.assert(
      fc.property(phoneLogArb, fc.nat(), fc.nat(), (ops, a, b) => {
        fc.pre(
          ledgerOf(ops).entries.every(({ entry }) => entry.kind === 'transfer' || entry.rate === 1),
        );
        mergeMovesOnlyTheMergedBalance(ops, a, b);
      }),
      runs,
    );
  });

  it('lets no two phones be the same member while nobody merges members', () => {
    fc.assert(
      fc.property(logArb, (ops) => {
        fc.pre(ops.every((op) => op.change?.kind !== 'member.merged'));
        noTwoPhonesAreTheSameMember(ops);
      }),
      runs,
    );
  });
});

/**
 * Properties the code breaks today. Each runs its smallest counterexample first, so it fails on
 * every run; `it.fails` keeps the suite green while that is so. Once the code is fixed the test
 * turns red: change `it.fails` back to `it` and move it up. Never loosen one to make it pass.
 */
describe('ledger fold properties the code breaks today', () => {
  // A ¥3 expense, ¥1 each for m0, m1 and m2, paid by m0, at 0.005 SGD per yen: 2 SGD cents in
  // all. m2 is even. Merging m0 into m1 rounds the 2 cents across two shares instead of three,
  // and m2 owes 1 cent though m2 was not part of the merge.
  const roundingAcrossAMerge: [ConfirmedOp[], number, number] = [
    [
      confirmed(1, created, PHONES[0]),
      ...[MEMBERS[0], MEMBERS[1], MEMBERS[2]].map((id, index) =>
        confirmed(index + 2, { kind: 'member.put', member: makeMember(id) }, PHONES[0]),
      ),
      confirmed(
        5,
        {
          kind: 'entry.put',
          base: null,
          entry: makeExpense(
            'e1',
            { [MEMBERS[0]]: 100, [MEMBERS[1]]: 100, [MEMBERS[2]]: 100 },
            { currency: 'JPY', rate: 0.005, payer: MEMBERS[0] },
          ),
        },
        PHONES[0],
      ),
    ],
    0,
    0,
  ];

  it.fails(
    "moves only the merged member's balance into the member it joins, in any currency",
    () => {
      fc.assert(fc.property(phoneLogArb, fc.nat(), fc.nat(), mergeMovesOnlyTheMergedBalance), {
        ...runs,
        examples: [roundingAcrossAMerge],
      });
    },
  );

  // u2 is m2 and u0 is m3. u0 merges m3 into m2, and both phones are now m2.
  const claimedTwiceByAMerge: [ConfirmedOp[]] = [
    [
      confirmed(1, created, PHONES[0]),
      confirmed(2, { kind: 'member.put', member: makeMember(MEMBERS[2]) }, PHONES[0]),
      confirmed(3, { kind: 'member.put', member: makeMember(MEMBERS[3]) }, PHONES[0]),
      confirmed(4, { kind: 'member.claimed', memberId: MEMBERS[2] }, PHONES[2]),
      confirmed(5, { kind: 'member.claimed', memberId: MEMBERS[3] }, PHONES[0]),
      confirmed(6, { kind: 'member.merged', from: MEMBERS[3], into: MEMBERS[2] }, PHONES[0]),
    ],
  ];

  it.fails('lets no two phones be the same member, merges included', () => {
    fc.assert(fc.property(logArb, noTwoPhonesAreTheSameMember), {
      ...runs,
      examples: [claimedTwiceByAMerge],
    });
  });
});

/**
 * Merges two live members (picked by `a` and `b`) at the end of the log: the merged member's
 * balance moves into the member it joins, nobody else's changes, and neither does what the group
 * spent. Only over entries the expense form can post (see `paidInFull`).
 */
function mergeMovesOnlyTheMergedBalance(ops: ConfirmedOp[], a: number, b: number) {
  const before = ledgerOf(ops);
  const live = before.members.map((member) => member.id);
  fc.pre(live.length >= 2);
  fc.pre(before.entries.every(({ entry }) => entry.kind === 'transfer' || paidInFull(entry)));
  const from = live[a % live.length];
  const into = live[(a + 1 + (b % (live.length - 1))) % live.length];
  const after = ledgerOf(append(ops, { kind: 'member.merged', from, into }, PHONES[0]));

  const was = computeBalances(before);
  const now = computeBalances(after);
  const balance = (book: Record<MemberId, number>, id: MemberId) => book[id] ?? 0;
  expect(balance(now, from)).toBe(0);
  expect(balance(now, into)).toBe(balance(was, from) + balance(was, into));
  for (const id of new Set([...memberIdsOf(was), ...memberIdsOf(now)])) {
    if (id === from || id === into) continue;
    expect(balance(now, id)).toBe(balance(was, id));
  }

  const spent = (ledger: Ledger) =>
    sum(
      ledger.entries.map(({ entry }) =>
        entry.kind === 'expense' ? Math.round(totalCents(entry) * entry.rate) : 0,
      ),
    );
  expect(spent(after)).toBe(spent(before));
}

/** Every phone that has said who it is names a different member. */
function noTwoPhonesAreTheSameMember(ops: ConfirmedOp[]) {
  const claimed = PHONES.map((phone) => ledgerOf(ops, phone).me).filter((id) => id !== null);
  expect(new Set(claimed).size).toBe(claimed.length);
}
