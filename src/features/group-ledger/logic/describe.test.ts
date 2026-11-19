import { describe, expect, it } from 'vitest';
import type { Change, GroupLog, UserId } from '@features/group-ledger/domain/types';
import {
  describeActivity,
  describeBalance,
  describeEntry,
  describeMyBalance,
  describeMyShare,
  describeSettleUp,
  memberName,
} from './describe';
import { asOpId } from './ids';
import {
  ana,
  anaPhone,
  ben,
  benPhone,
  cat,
  confirmed,
  created,
  fold,
  makeExpense,
  makeLog,
  makeMember,
  makeTransfer,
  logOf,
  put,
} from './testHelpers';

const grab = makeExpense('grab', { [ana]: 900, [ben]: 900 }, { title: 'Grab' });

function benDoes(...changes: Array<Change | null>): GroupLog {
  const start = [created, put(makeMember(ana)), put(makeMember(ben))];
  return makeLog([
    ...start.map((change, index) => confirmed(index + 1, change, anaPhone)),
    confirmed(4, { kind: 'member.claimed', memberId: ben }, benPhone),
    ...changes.map((change, index) => confirmed(index + 5, change, benPhone)),
  ]);
}

function latest(log: GroupLog, self: UserId = anaPhone): string {
  const ledger = fold(log, self);
  return describeActivity(ledger.activity[0], ledger);
}

describe('describeActivity', () => {
  it('says who added an expense and what it came to', () => {
    expect(latest(benDoes({ kind: 'entry.put', entry: grab, base: null }))).toBe(
      'Ben added Grab · $18.00',
    );
  });

  it('writes the amount in the expense’s own currency', () => {
    const ramen = makeExpense('ramen', { [ana]: 120_000 }, { title: 'Ramen', currency: 'JPY' });

    expect(latest(benDoes({ kind: 'entry.put', entry: ramen, base: null }))).toBe(
      'Ben added Ramen · ¥1,200',
    );
  });

  it('describes changing, removing and restoring an entry', () => {
    const add: Change = { kind: 'entry.put', entry: grab, base: null };
    const edit: Change = {
      kind: 'entry.put',
      entry: { ...grab, title: 'Grab home' },
      base: asOpId('c5'),
    };
    const remove: Change = { kind: 'entry.removed', entryId: grab.id, base: asOpId('c5') };
    const restore: Change = { kind: 'entry.put', entry: grab, base: asOpId('c6') };

    expect(latest(benDoes(add, edit))).toBe('Ben changed Grab home · $18.00');
    expect(latest(benDoes(add, remove))).toBe('Ben removed Grab · $18.00');
    expect(latest(benDoes(add, remove, restore))).toBe('Ben restored Grab · $18.00');
  });

  it('describes a payment between two members in the group’s currency', () => {
    const paid = makeTransfer('paid', ben, ana, 1250);

    expect(latest(benDoes({ kind: 'entry.put', entry: paid, base: null }))).toBe(
      'Ben added Ben paid Ana · $12.50',
    );
  });

  it('describes the group being created and renamed', () => {
    expect(latest(makeLog([confirmed(1, created)]))).toBe('Japan 2026 was created');
    expect(latest(benDoes({ kind: 'group.renamed', name: 'Tokyo' }))).toBe(
      'Ben renamed the group to Tokyo',
    );
  });

  it('describes members being added, renamed, archived, brought back, updated and merged', () => {
    const catAdded = put(makeMember(cat));

    expect(latest(benDoes(catAdded))).toBe('Ben added Cat');
    expect(latest(benDoes(catAdded, put(makeMember(cat, { name: 'Catherine' }))))).toBe(
      'Ben renamed Cat to Catherine',
    );
    expect(latest(benDoes(catAdded, put(makeMember(cat, { archived: true }))))).toBe(
      'Ben archived Cat',
    );
    expect(latest(benDoes(put(makeMember(cat, { archived: true })), catAdded))).toBe(
      'Ben brought back Cat',
    );
    expect(latest(benDoes(catAdded, put(makeMember(cat, { paynowMobile: '91234567' }))))).toBe(
      "Ben set Cat's PayNow number",
    );
    expect(latest(benDoes(catAdded, { kind: 'member.merged', from: cat, into: ana }))).toBe(
      'Ben merged Cat into Ana',
    );
  });

  it('describes someone joining as a member and stepping back', () => {
    expect(latest(benDoes())).toBe('Ben joined');
    expect(latest(benDoes({ kind: 'member.claimed', memberId: null }))).toBe('Ben stepped back');
  });

  it('asks for an update when a newer Split wrote the change', () => {
    expect(latest(benDoes(null))).toBe('Update Split to see this change');
  });
});

describe('describeEntry and memberName', () => {
  const ledger = fold(
    benDoes(put(makeMember(cat)), { kind: 'member.merged', from: cat, into: ana }),
  );

  it('names a merged-away member as the member they became, and a stranger as Someone', () => {
    expect(memberName(ledger, cat)).toBe('Ana');
    expect(memberName(ledger, ben)).toBe('Ben');
    expect(describeEntry(makeTransfer('paid', cat, ben, 500), ledger)).toBe('Ana paid Ben · $5.00');
  });

  it('gives an expense with no title a placeholder', () => {
    expect(describeEntry({ ...grab, title: '  ' }, ledger)).toBe('Untitled expense · $18.00');
  });
});

describe('balance wording', () => {
  it("words my balance and anyone else's by which way it points", () => {
    expect(describeMyBalance(4210, 'SGD')).toEqual({
      direction: 'owed',
      text: "you're owed $42.10",
    });
    expect(describeMyBalance(-1200, 'SGD')).toEqual({ direction: 'owes', text: 'you owe $12.00' });
    expect(describeMyBalance(0, 'SGD')).toEqual({ direction: 'even', text: 'settled up' });
    expect(describeBalance(4210, 'SGD').text).toBe('gets back $42.10');
    expect(describeBalance(-1200, 'SGD').text).toBe('owes $12.00');
  });

  it('says what an entry did to me, in the group currency', () => {
    const ledger = fold(logOf(created, put(makeMember(ana)), put(makeMember(ben))));
    const usd = makeExpense('usd', { [ana]: 1000, [ben]: 1000 }, { currency: 'USD', rate: 1.5 });

    const transfer = makeTransfer('t', ben, ana, 500);
    expect(describeMyShare(usd, ledger, ana)).toEqual({
      direction: 'owed',
      label: 'you lent',
      amount: '$15.00',
    });
    expect(describeMyShare(usd, ledger, ben)).toEqual({
      direction: 'owes',
      label: 'you owe',
      amount: '$15.00',
    });
    expect(describeMyShare(usd, ledger, cat)).toEqual({
      direction: 'even',
      label: 'not involved',
      amount: null,
    });
    expect(describeMyShare(usd, ledger, null).direction).toBe('even');
    expect(describeMyShare(transfer, ledger, ben).label).toBe('you paid');
    expect(describeMyShare(transfer, ledger, ana).label).toBe('you got');
  });

  it('writes the settle-up list for a chat', () => {
    const ledger = fold(logOf(created, put(makeMember(ana)), put(makeMember(ben))));

    expect(describeSettleUp([{ from: ben, to: ana, cents: 4210 }], ledger)).toBe(
      'Japan 2026: settling up\n• Ben pays Ana $42.10',
    );
    expect(describeSettleUp([], ledger)).toBe('Japan 2026: everyone is settled up.');
  });
});
