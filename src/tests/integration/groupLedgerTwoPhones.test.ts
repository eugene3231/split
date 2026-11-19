import { describe, expect, it } from 'vitest';
import type { InviteCode, Ledger, UserId } from '@features/group-ledger/domain/types';
import { createFakeBackend } from '@features/group-ledger/backend/fakeBackend';
import { createMemoryServer, type FakeServer } from '@features/group-ledger/backend/fakeServer';
import { computeBalances } from '@features/group-ledger/logic/balances';
import {
  blankDraft,
  checkExpense,
  type ExpenseDraft,
} from '@features/group-ledger/logic/expenseForm';
import { foldLedger } from '@features/group-ledger/logic/fold';
import {
  asLocalDate,
  newEntryId,
  newGroupId,
  newInviteCode,
} from '@features/group-ledger/logic/ids';
import { newGroupChanges } from '@features/group-ledger/logic/newGroup';
import { settleUp } from '@features/group-ledger/logic/settleUp';
import { openDeviceLog } from '@features/group-ledger/sync/deviceLog';
import { groupActions } from '@features/group-ledger/sync/groupActions';
import { createGroupSync, type GroupSync } from '@features/group-ledger/sync/groupSync';

// Two phones on one in-memory fake server, each wired the way the screens wire a group: changes
// go in through `groupActions`, expenses are built by the quick expense form's `checkExpense`,
// and what each phone shows is folded from its own log.

function phone(server: FakeServer, profile: string) {
  let online = true;
  const backend = createFakeBackend({ server, profile, isOnline: () => online });
  let engine: GroupSync | null = null;
  let self: UserId | null = null;

  return {
    backend,
    setOnline(next: boolean) {
      online = next;
    },
    open(
      group: { groupId: ReturnType<typeof newGroupId>; inviteCode: InviteCode },
      createdHere: boolean,
    ) {
      engine = createGroupSync({
        group: { ...group, createdHere },
        backend,
        log: openDeviceLog(profile, group.groupId),
      });
      return engine;
    },
    async sync() {
      await engine?.syncNow();
      const session = await backend.session();
      if (session.ok) self = session.value.userId;
    },
    ledger(): Ledger {
      if (!engine) throw new Error(`${profile} holds no group`);
      const ledger = foldLedger(engine.getSnapshot().log, self);
      if (!ledger) throw new Error(`${profile} has not loaded the group`);
      return ledger;
    },
    act() {
      if (!engine) throw new Error(`${profile} holds no group`);
      return groupActions(engine.submit);
    },
  };
}

/** A quick expense as the form would build it, paid by this phone's member. */
function expense(ledger: Ledger, amount: string, title: string, patch: Partial<ExpenseDraft> = {}) {
  if (ledger.me === null) throw new Error('this phone has not said who it is');
  const draft = {
    ...blankDraft(ledger.members, ledger.me, ledger.currency, asLocalDate('2026-11-19')),
    amount,
    title,
    ...patch,
  };
  const check = checkExpense(draft, newEntryId(), ledger.currency);
  if (!check.ok) throw new Error(check.reason);
  return check.entry;
}

const byName = (ledger: Ledger, name: string) => {
  const member = ledger.members.find((candidate) => candidate.name === name);
  if (!member) throw new Error(`no member called ${name}`);
  return member.id;
};

describe('two phones sharing a group', () => {
  it('create, join, add expenses on and offline, converge, then settle to zero', async () => {
    const server = createMemoryServer();
    const ana = phone(server, 'ana');
    const ben = phone(server, 'ben');

    // Ana makes the group with two friends.
    const group = { groupId: newGroupId(), inviteCode: newInviteCode() };
    const engineA = ana.open(group, true);
    const { changes } = newGroupChanges({
      name: 'Japan 2026',
      currency: 'SGD',
      myName: 'Ana',
      friendNames: ['Ben', 'Cat'],
    });
    for (const change of changes) engineA.submit(change);
    await ana.sync();

    // Ben opens the invite link and says which member he is.
    const joined = await ben.backend.joinGroup(group.inviteCode);
    expect(joined.ok).toBe(true);
    ben.open(group, false);
    await ben.sync();
    expect(ben.ledger().me).toBeNull();
    ben.act().claim(byName(ben.ledger(), 'Ben'));
    await ben.sync();
    expect(ben.ledger().me).toBe(byName(ben.ledger(), 'Ben'));

    // Ana pays 90 for dinner between all three. Ben pays 40 for a taxi, offline, between him and Ana.
    ana.act().addExpense(expense(ana.ledger(), '90', 'Dinner'));
    await ana.sync();
    ben.setOnline(false);
    const benLedger = ben.ledger();
    ben.act().addExpense(
      expense(benLedger, '40', 'Taxi', {
        splitBy: { kind: 'evenly', between: [byName(benLedger, 'Ana'), byName(benLedger, 'Ben')] },
      }),
    );
    await ben.sync();
    expect(ben.ledger().entries.map((posted) => [posted.entry.kind, posted.pending])).toEqual([
      ['expense', true],
      ['expense', false],
    ]);
    expect(ana.ledger().entries).toHaveLength(1);

    ben.setOnline(true);
    await ben.sync();
    await ana.sync();

    const ids = (ledger: Ledger) => ({
      ana: byName(ledger, 'Ana'),
      ben: byName(ledger, 'Ben'),
      cat: byName(ledger, 'Cat'),
    });
    const { ana: a, ben: b, cat: c } = ids(ana.ledger());
    const balancesA = computeBalances(ana.ledger());
    expect(balancesA).toEqual({ [a]: 4000, [b]: -1000, [c]: -3000 });
    expect(computeBalances(ben.ledger())).toEqual(balancesA);
    const transfers = settleUp(balancesA);
    expect(settleUp(computeBalances(ben.ledger()))).toEqual(transfers);
    expect(transfers).toEqual([
      { from: c, to: a, cents: 3000 },
      { from: b, to: a, cents: 1000 },
    ]);

    // Ben marks both paid from his phone.
    for (const transfer of transfers) ben.act().markPaid(transfer);
    await ben.sync();
    await ana.sync();

    expect(computeBalances(ana.ledger())).toEqual({ [a]: 0, [b]: 0, [c]: 0 });
    expect(settleUp(computeBalances(ana.ledger()))).toEqual([]);
    expect(ana.ledger().activity.map((row) => row.pending)).not.toContain(true);
  });
});
