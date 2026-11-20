import { entryEffect } from '@features/group-ledger/logic/balances';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Change, ConfirmedOp } from '@features/group-ledger/domain/types';
import { foldLedger } from './fold';
import { asOpId, memberIdsOf } from './ids';
import {
  ana,
  anaPhone,
  ben,
  benPhone,
  cat,
  confirmed,
  confirmedOpsArb,
  created,
  fold,
  logOf,
  makeExpense,
  makeLog,
  makeMember,
  makeTransfer,
  pending,
  pendingChangesArb,
  put,
} from './testHelpers';
import { makeItem, makeReceipt } from '../../../tests/integration/testHelpers';

const grab = makeExpense('grab', { [ana]: 900, [ben]: 900 }, { title: 'Grab' });
const grabEdited = makeExpense('grab', { [ana]: 1000, [ben]: 1000 }, { title: 'Grab' });
const grabByBen = makeExpense('grab', { [ana]: 500, [ben]: 1300 }, { title: 'Grab' });

const addGrab: Change = { kind: 'entry.put', entry: grab, base: null };
const claim = (memberId: typeof ana | null): Change => ({ kind: 'member.claimed', memberId });

describe('foldLedger: the group', () => {
  it('has no ledger until the log creates the group', () => {
    expect(foldLedger(makeLog([]), anaPhone)).toBeNull();
    expect(foldLedger(logOf(put(makeMember(ana))), anaPhone)).toBeNull();
  });

  it('takes its name and currency from the first group.created and ignores a second', () => {
    const ledger = fold(logOf(created, { kind: 'group.created', name: 'Other', currency: 'USD' }));

    expect(ledger.groupId).toBe('group-1');
    expect(ledger.name).toBe('Japan 2026');
    expect(ledger.currency).toBe('SGD');
    expect(ledger.activity.map((row) => row.what.kind)).toEqual(['group-created']);
  });

  it('renames the group, with an undo that puts the old name back', () => {
    const ledger = fold(logOf(created, { kind: 'group.renamed', name: 'Tokyo' }));

    expect(ledger.name).toBe('Tokyo');
    expect(ledger.activity[0].what).toEqual({
      kind: 'group-renamed',
      from: 'Japan 2026',
      to: 'Tokyo',
    });
    expect(ledger.activity[0].undo).toEqual({ kind: 'group.renamed', name: 'Japan 2026' });
  });

  it('ignores whatever comes before the group is created', () => {
    const ledger = fold(logOf(put(makeMember(ana)), created));

    expect(ledger.members).toEqual([]);
    expect(ledger.activity).toHaveLength(1);
  });
});

describe('foldLedger: members', () => {
  it('lists members in the order they were added, archived ones included', () => {
    const ledger = fold(
      logOf(created, put(makeMember(ben)), put(makeMember(ana, { archived: true }))),
    );

    expect(ledger.members.map((member) => member.id)).toEqual(['ben', 'ana']);
    expect(ledger.activity[0].what).toEqual({
      kind: 'member-added',
      member: makeMember(ana, { archived: true }),
    });
    expect(ledger.activity[0].undo).toBeNull();
  });

  it('changes a member in place, with an undo that puts the old version back', () => {
    const before = makeMember(ana);
    const after = makeMember(ana, { name: 'Anabel', paynowMobile: '91234567' });
    const ledger = fold(logOf(created, put(before), put(makeMember(ben)), put(after)));

    expect(ledger.members).toEqual([after, makeMember(ben)]);
    expect(ledger.activity[0].what).toEqual({ kind: 'member-changed', before, after });
    expect(ledger.activity[0].undo).toEqual(put(before));
  });

  it('merges one member into another: the first leaves the list and reads as the second', () => {
    const ledger = fold(
      logOf(created, put(makeMember(ana)), put(makeMember(ben)), {
        kind: 'member.merged',
        from: ben,
        into: ana,
      }),
    );

    expect(ledger.members).toEqual([makeMember(ana)]);
    expect(ledger.activity[0].what).toEqual({
      kind: 'member-merged',
      from: makeMember(ben),
      into: makeMember(ana),
    });
    expect(ledger.activity[0].undo).toBeNull();
  });

  it('follows a chain of merges to the member left at the end', () => {
    const ledger = fold(
      logOf(
        created,
        put(makeMember(ana)),
        put(makeMember(ben)),
        put(makeMember(cat)),
        { kind: 'entry.put', entry: makeTransfer('paid', ana, ben, 300), base: null },
        { kind: 'member.merged', from: ana, into: ben },
        { kind: 'member.merged', from: ben, into: cat },
      ),
    );

    expect(ledger.members.map((member) => member.id)).toEqual(['cat']);
    expect(ledger.entries[0].entry).toMatchObject({ from: cat, to: cat });
  });

  it('hands out entries that name only the member each merged-away member became', () => {
    const receipt = {
      ...makeExpense('receipt', { [ana]: 250, [ben]: 250, [cat]: 500 }),
      basis: {
        kind: 'receipt' as const,
        receipt: makeReceipt({
          items: [
            makeItem({
              assignment: { shares: { [ana]: 1, [ben]: 1, [cat]: 2 }, unassignedShare: 0 },
            }),
          ],
        }),
      },
    };
    const weighted = {
      ...makeExpense(
        'dinner',
        { [ana]: 500, [ben]: 500, [cat]: 1000 },
        {
          payer: ben,
          others: { [ana]: 400, [cat]: 600 },
        },
      ),
      basis: { kind: 'weights' as const, weights: { [ana]: 1, [ben]: 1, [cat]: 2 } },
    };
    const ledger = fold(
      logOf(
        created,
        put(makeMember(ana)),
        put(makeMember(ben)),
        put(makeMember(cat)),
        { kind: 'entry.put', entry: weighted, base: null },
        { kind: 'entry.put', entry: receipt, base: null },
        { kind: 'entry.put', entry: makeTransfer('paid', ben, cat, 300), base: null },
        { kind: 'member.merged', from: ben, into: ana },
      ),
    );
    const byId = (id: string) => ledger.entries.find((posted) => posted.entry.id === id)?.entry;

    expect(byId('dinner')).toMatchObject({
      owed: { [ana]: 1000, [cat]: 1000 },
      payment: { payer: ana, others: { [cat]: 600 } },
      basis: { kind: 'weights', weights: { [ana]: 2, [cat]: 2 } },
    });
    expect(byId('receipt')).toMatchObject({
      basis: { receipt: { items: [{ assignment: { shares: { [ana]: 2, [cat]: 2 } } }] } },
    });
    expect(byId('paid')).toMatchObject({ from: ana, to: cat });
    expect(ledger.activity.find((row) => row.what.kind === 'entry-added')?.what).toMatchObject({
      entry: { from: ana, to: cat },
    });
  });

  it('ignores a merge that would loop back, a merge into itself and a merge of a stranger', () => {
    const ledger = fold(
      logOf(
        created,
        put(makeMember(ana)),
        put(makeMember(ben)),
        { kind: 'member.merged', from: ana, into: ben },
        { kind: 'member.merged', from: ben, into: ana },
        { kind: 'member.merged', from: ben, into: ben },
        { kind: 'member.merged', from: cat, into: ben },
      ),
    );

    expect(ledger.members.map((member) => member.id)).toEqual(['ben']);
    expect(ledger.activity.map((row) => row.what.kind)).toEqual([
      'member-merged',
      'member-added',
      'member-added',
      'group-created',
    ]);
  });

  it('ignores a change to a member another phone has already merged away', () => {
    const ledger = fold(
      logOf(
        created,
        put(makeMember(ana)),
        put(makeMember(ben)),
        { kind: 'member.merged', from: ben, into: ana },
        put(makeMember(ben, { name: 'Benny' })),
      ),
    );

    expect(ledger.members).toEqual([makeMember(ana)]);
    expect(ledger.activity[0].what.kind).toBe('member-merged');
  });
});

describe('foldLedger: who is who', () => {
  const base = [
    confirmed(1, created, anaPhone),
    confirmed(2, put(makeMember(ana)), anaPhone),
    confirmed(3, put(makeMember(ben)), anaPhone),
  ];

  it('knows this device by the latest claim its user sent', () => {
    const log = makeLog([
      ...base,
      confirmed(4, claim(ben), anaPhone),
      confirmed(5, claim(ana), anaPhone),
      confirmed(6, claim(ben), benPhone),
    ]);

    expect(fold(log, anaPhone).me).toBe('ana');
    expect(fold(log, benPhone).me).toBe('ben');
    expect(fold(log, null).me).toBeNull();
    expect([...fold(log, anaPhone).claimed].sort()).toEqual(['ana', 'ben']);
  });

  it('ignores a claim on a member another device already holds, and leaves no row for it', () => {
    const log = makeLog([
      ...base,
      confirmed(4, claim(ana), anaPhone),
      confirmed(5, claim(ana), benPhone),
      confirmed(6, claim(ana), anaPhone),
    ]);

    expect(fold(log, anaPhone).me).toBe('ana');
    expect(fold(log, benPhone).me).toBeNull();
    expect([...fold(log, benPhone).claimed]).toEqual(['ana']);
    expect(fold(log, anaPhone).activity.map((row) => row.opId)).toEqual([
      'c6',
      'c4',
      'c3',
      'c2',
      'c1',
    ]);
  });

  it('keeps the claim a device already had when the member it asks for is taken', () => {
    const log = makeLog([
      ...base,
      confirmed(4, claim(ana), anaPhone),
      confirmed(5, claim(ben), benPhone),
      confirmed(6, claim(ana), benPhone),
    ]);

    expect(fold(log, benPhone).me).toBe('ben');
    expect([...fold(log, benPhone).claimed].sort()).toEqual(['ana', 'ben']);
  });

  it('frees a member for someone else once its holder steps back or claims another', () => {
    const steppedBack = makeLog([
      ...base,
      confirmed(4, claim(ana), anaPhone),
      confirmed(5, claim(null), anaPhone),
      confirmed(6, claim(ana), benPhone),
    ]);
    const movedOn = makeLog([
      ...base,
      confirmed(4, claim(ana), anaPhone),
      confirmed(5, claim(ben), anaPhone),
      confirmed(6, claim(ana), benPhone),
    ]);

    expect(fold(steppedBack, benPhone).me).toBe('ana');
    expect(fold(movedOn, benPhone).me).toBe('ana');
    expect(fold(movedOn, anaPhone).me).toBe('ben');
  });

  it('counts a member as held under the name it was merged into', () => {
    const log = makeLog([
      ...base,
      confirmed(4, claim(ana), anaPhone),
      confirmed(5, { kind: 'member.merged', from: ben, into: ana }, anaPhone),
      confirmed(6, claim(ben), benPhone),
    ]);

    expect(fold(log, benPhone).me).toBeNull();
    expect(fold(log, anaPhone).me).toBe('ana');
  });

  it("ignores this phone's pending claim on a member someone else has since taken", () => {
    const log = makeLog([...base, confirmed(4, claim(ben), benPhone)], [pending(1, claim(ben))]);

    expect(fold(log, anaPhone).me).toBeNull();
    expect([...fold(log, anaPhone).claimed]).toEqual(['ben']);
  });

  it('steps back to nobody on a null claim', () => {
    const ledger = fold(makeLog([...base, confirmed(4, claim(ana)), confirmed(5, claim(null))]));

    expect(ledger.me).toBeNull();
    expect([...ledger.claimed]).toEqual([]);
    expect(ledger.activity[0].what).toEqual({ kind: 'member-claimed', member: null });
    expect(ledger.activity[0].by).toBe('ana');
  });

  it('counts a pending claim as this device, even before the session is known', () => {
    const log = makeLog(base, [pending(1, claim(ben))]);

    expect(fold(log, anaPhone).me).toBe('ben');
    expect(fold(log, null).me).toBe('ben');
  });

  it('reads a claim on a merged-away member as the member it became', () => {
    const ledger = fold(
      makeLog([
        ...base,
        confirmed(4, claim(ben), benPhone),
        confirmed(5, { kind: 'member.merged', from: ben, into: ana }, anaPhone),
      ]),
      benPhone,
    );

    expect(ledger.me).toBe('ana');
    expect([...ledger.claimed]).toEqual(['ana']);
    expect(ledger.activity[1].by).toBe('ana');
  });

  it('has no claim on a member the log never added', () => {
    const ledger = fold(makeLog([...base, confirmed(4, claim(cat))]));

    expect(ledger.me).toBeNull();
    expect(ledger.activity[0].what).toEqual({ kind: 'member-claimed', member: null });
  });

  it('signs each activity row with the member its author had claimed at that point', () => {
    const ledger = fold(
      makeLog(
        [
          ...base,
          confirmed(4, addGrab, benPhone),
          confirmed(5, claim(ben), benPhone),
          confirmed(6, { kind: 'entry.put', entry: grabEdited, base: asOpId('c4') }, benPhone),
          confirmed(7, claim(ana), anaPhone),
        ],
        [pending(1, { kind: 'group.renamed', name: 'Tokyo' })],
      ),
      anaPhone,
    );

    expect(ledger.activity.map((row) => [row.opId, row.by, row.pending])).toEqual([
      ['p1', 'ana', true],
      ['c7', 'ana', false],
      ['c6', 'ben', false],
      ['c5', 'ben', false],
      ['c4', null, false],
      ['c3', null, false],
      ['c2', null, false],
      ['c1', null, false],
    ]);
    expect(ledger.activity[0].at).toBe('2026-11-19T11:00:01Z');
  });
});

describe('foldLedger: entries', () => {
  const start = [created, put(makeMember(ana)), put(makeMember(ben))];

  it('posts a new entry, with an undo that removes it', () => {
    const ledger = fold(logOf(...start, addGrab));

    expect(ledger.entries).toEqual([
      { entry: grab, written: grab, effect: entryEffect(grab), rev: 'c4', pending: false },
    ]);
    expect(ledger.activity[0]).toMatchObject({
      what: { kind: 'entry-added', entry: grab },
      replaced: null,
      undo: { kind: 'entry.removed', entryId: 'grab', base: 'c4' },
    });
  });

  it('replaces an entry whole when its author had seen the current version', () => {
    const ledger = fold(
      logOf(...start, addGrab, { kind: 'entry.put', entry: grabEdited, base: asOpId('c4') }),
    );

    expect(ledger.entries).toEqual([
      {
        entry: grabEdited,
        written: grabEdited,
        effect: entryEffect(grabEdited),
        rev: 'c5',
        pending: false,
      },
    ]);
    expect(ledger.activity[0]).toMatchObject({
      what: { kind: 'entry-changed', before: grab, after: grabEdited },
      replaced: null,
      undo: { kind: 'entry.put', entry: grab, base: 'c5' },
    });
  });

  it('lets the later of two edits made apart win, and says which version it replaced', () => {
    const ledger = fold(
      logOf(
        ...start,
        addGrab,
        { kind: 'entry.put', entry: grabEdited, base: asOpId('c4') },
        { kind: 'entry.put', entry: grabByBen, base: asOpId('c4') },
      ),
    );

    expect(ledger.entries).toEqual([
      {
        entry: grabByBen,
        written: grabByBen,
        effect: entryEffect(grabByBen),
        rev: 'c6',
        pending: false,
      },
    ]);
    expect(ledger.activity[0].replaced).toEqual(grabEdited);
    expect(ledger.activity[0].undo).toEqual({ kind: 'entry.put', entry: grabEdited, base: 'c6' });
  });

  it('removes an entry, with an undo that restores it', () => {
    const ledger = fold(
      logOf(...start, addGrab, { kind: 'entry.removed', entryId: grab.id, base: asOpId('c4') }),
    );

    expect(ledger.entries).toEqual([]);
    expect(ledger.activity[0]).toMatchObject({
      what: { kind: 'entry-removed', entry: grab },
      replaced: null,
      undo: { kind: 'entry.put', entry: grab, base: 'c5' },
    });
  });

  it('says so when a remove lands on a version its author never saw', () => {
    const ledger = fold(
      logOf(
        ...start,
        addGrab,
        { kind: 'entry.put', entry: grabEdited, base: asOpId('c4') },
        { kind: 'entry.removed', entryId: grab.id, base: asOpId('c4') },
      ),
    );

    expect(ledger.entries).toEqual([]);
    expect(ledger.activity[0].what).toEqual({ kind: 'entry-removed', entry: grabEdited });
    expect(ledger.activity[0].replaced).toEqual(grabEdited);
  });

  it('leaves no trace of removing an entry that is already gone', () => {
    const remove: Change = { kind: 'entry.removed', entryId: grab.id, base: asOpId('c4') };
    const ledger = fold(logOf(...start, addGrab, remove, remove));

    expect(ledger.entries).toEqual([]);
    expect(ledger.activity.map((row) => row.opId)).toEqual(['c5', 'c4', 'c3', 'c2', 'c1']);
  });

  it('restores a removed entry when the put is based on the remove', () => {
    const ledger = fold(
      logOf(
        ...start,
        addGrab,
        { kind: 'entry.removed', entryId: grab.id, base: asOpId('c4') },
        { kind: 'entry.put', entry: grab, base: asOpId('c5') },
      ),
    );

    expect(ledger.entries).toEqual([
      { entry: grab, written: grab, effect: entryEffect(grab), rev: 'c6', pending: false },
    ]);
    expect(ledger.activity[0]).toMatchObject({
      what: { kind: 'entry-restored', entry: grab },
      replaced: null,
      undo: { kind: 'entry.removed', entryId: 'grab', base: 'c6' },
    });
  });

  it('lets an edit beat a remove it never saw: the entry comes back and the row says what it replaced', () => {
    const ledger = fold(
      logOf(
        ...start,
        addGrab,
        { kind: 'entry.removed', entryId: grab.id, base: asOpId('c4') },
        { kind: 'entry.put', entry: grabEdited, base: asOpId('c4') },
      ),
    );

    expect(ledger.entries).toEqual([
      {
        entry: grabEdited,
        written: grabEdited,
        effect: entryEffect(grabEdited),
        rev: 'c6',
        pending: false,
      },
    ]);
    expect(ledger.activity[0]).toMatchObject({
      what: { kind: 'entry-changed', before: grab, after: grabEdited },
      replaced: grab,
      undo: { kind: 'entry.removed', entryId: 'grab', base: 'c6' },
    });
  });

  it('lists entries newest date first, then newest in the log, and an edit does not move one', () => {
    const lunch = makeExpense('lunch', { [ana]: 500 }, { date: '2026-11-18' });
    const taxi = makeExpense('taxi', { [ana]: 700 }, { date: '2026-11-19' });
    const paid = makeTransfer('paid', ben, ana, 300, '2026-11-19');
    const ledger = fold(
      logOf(
        ...start,
        { kind: 'entry.put', entry: lunch, base: null },
        { kind: 'entry.put', entry: taxi, base: null },
        { kind: 'entry.put', entry: paid, base: null },
        { kind: 'entry.put', entry: { ...taxi, title: 'Taxi home' }, base: asOpId('c5') },
      ),
    );

    expect(ledger.entries.map((posted) => [posted.entry.id, posted.rev])).toEqual([
      ['paid', 'c6'],
      ['taxi', 'c7'],
      ['lunch', 'c4'],
    ]);
  });

  it('shows a change a newer Split wrote as unknown and carries on', () => {
    const ledger = fold(logOf(...start, null, addGrab));

    expect(ledger.entries).toHaveLength(1);
    expect(ledger.activity[1]).toMatchObject({
      opId: 'c4',
      what: { kind: 'unknown' },
      replaced: null,
      undo: null,
    });
  });
});

describe('foldLedger: the order of ops', () => {
  const start = [confirmed(1, created), confirmed(2, put(makeMember(ana)))];

  it('applies pending ops after every confirmed one and marks what they wrote as pending', () => {
    const ledger = fold(
      makeLog(
        [...start, confirmed(3, addGrab)],
        [pending(1, { kind: 'entry.put', entry: grabEdited, base: asOpId('c3') })],
      ),
    );

    expect(ledger.entries).toEqual([
      {
        entry: grabEdited,
        written: grabEdited,
        effect: entryEffect(grabEdited),
        rev: 'p1',
        pending: true,
      },
    ]);
    expect(ledger.activity[0]).toMatchObject({ opId: 'p1', pending: true, replaced: null });
  });

  it('shows a pending change this version cannot read as unknown, where this phone made it', () => {
    const ledger = fold({
      ...makeLog(start, [
        pending(1, addGrab),
        pending(3, { kind: 'group.renamed', name: 'Tokyo' }),
      ]),
      unreadablePending: [{ id: asOpId('p2'), order: 2, at: '2026-11-19T11:00:02Z' }],
    });

    expect(
      ledger.activity.slice(0, 3).map((row) => [row.opId, row.what.kind, row.pending]),
    ).toEqual([
      ['p3', 'group-renamed', true],
      ['p2', 'unknown', true],
      ['p1', 'entry-added', true],
    ]);
    expect(ledger.activity[1].undo).toBeNull();
  });

  it('skips a pending op the server has already confirmed', () => {
    const sent: ConfirmedOp = { ...confirmed(3, addGrab), id: asOpId('p1') };
    const ledger = fold(makeLog([...start, sent], [pending(1, addGrab)]));

    expect(ledger.entries).toEqual([
      { entry: grab, written: grab, effect: entryEffect(grab), rev: 'p1', pending: false },
    ]);
    expect(ledger.activity.map((row) => row.opId)).toEqual(['p1', 'c2', 'c1']);
  });

  it('reads confirmed ops by seq and pending ops by order, however the arrays are sorted', () => {
    const edit: Change = { kind: 'entry.put', entry: grabEdited, base: asOpId('p1') };
    const ledger = fold(
      makeLog(
        [confirmed(2, put(makeMember(ana))), confirmed(1, created)],
        [pending(2, edit), pending(1, addGrab)],
      ),
    );

    expect(ledger.members).toEqual([makeMember(ana)]);
    expect(ledger.entries).toEqual([
      {
        entry: grabEdited,
        written: grabEdited,
        effect: entryEffect(grabEdited),
        rev: 'p2',
        pending: true,
      },
    ]);
    expect(ledger.activity[0].replaced).toBeNull();
  });
});

const shuffled = <T>(items: T[]) => fc.shuffledSubarray(items, { minLength: items.length });

describe('foldLedger properties', () => {
  it('reads the same ledger from the same confirmed ops, in whatever order they are held', () => {
    fc.assert(
      fc.property(
        confirmedOpsArb.chain((ops) => fc.tuple(fc.constant(ops), shuffled(ops))),
        ([ops, reordered]) => {
          expect(foldLedger(makeLog(reordered), anaPhone)).toEqual(
            foldLedger(makeLog(ops), anaPhone),
          );
        },
      ),
    );
  });

  it('reads an op held as both pending and confirmed once, as confirmed', () => {
    fc.assert(
      fc.property(
        confirmedOpsArb.chain((ops) => fc.tuple(fc.constant(ops), fc.subarray(ops))),
        pendingChangesArb,
        ([ops, resent], changes) => {
          const fresh = changes.map((change, index) => pending(index + 100, change));
          const stale = resent.flatMap((op, index) =>
            op.change === null ? [] : [{ ...pending(index, op.change), id: op.id }],
          );

          expect(foldLedger(makeLog(ops, [...stale, ...fresh]), anaPhone)).toEqual(
            foldLedger(makeLog(ops, fresh), anaPhone),
          );
        },
      ),
    );
  });

  it('keeps the ledger whole: every member, claim and entry points at something real', () => {
    fc.assert(
      fc.property(confirmedOpsArb, pendingChangesArb, (ops, changes) => {
        const ledger = fold(
          makeLog(
            ops,
            changes.map((change, index) => pending(index, change)),
          ),
        );
        const live = new Set(ledger.members.map((member) => member.id));

        expect(live.size).toBe(ledger.members.length);
        const mergedAway = new Set(
          ledger.activity.flatMap(({ what }) =>
            what.kind === 'member-merged' ? [what.from.id] : [],
          ),
        );
        for (const { entry } of ledger.entries) {
          const named =
            entry.kind === 'transfer'
              ? [entry.from, entry.to]
              : [
                  entry.payment.payer,
                  ...memberIdsOf(entry.payment.others),
                  ...memberIdsOf(entry.owed),
                ];
          expect(named.filter((id) => mergedAway.has(id) && !live.has(id))).toEqual([]);
        }
        expect(ledger.me === null || live.has(ledger.me)).toBe(true);
        expect([...ledger.claimed].every((id) => live.has(id))).toBe(true);
        expect(new Set(ledger.entries.map((posted) => posted.entry.id)).size).toBe(
          ledger.entries.length,
        );
        const dates = ledger.entries.map((posted) => posted.entry.date);
        expect(dates).toEqual([...dates].sort().reverse());
      }),
    );
  });

  it('puts things back as they were when the undo of the latest op is applied', () => {
    fc.assert(
      fc.property(confirmedOpsArb, pendingChangesArb, (ops, changes) => {
        fc.pre(changes.length > 0);
        const pendingOps = changes.map((change, index) => pending(index, change));
        const before = fold(makeLog(ops, pendingOps.slice(0, -1)));
        const after = fold(makeLog(ops, pendingOps));
        const latest = pendingOps[pendingOps.length - 1];
        const row = after.activity[0];
        fc.pre(row.opId === latest.id && row.undo !== null);

        const undone = fold(makeLog(ops, [...pendingOps, pending(pendingOps.length, row.undo)]));

        expect(undone.name).toBe(before.name);
        expect(undone.members).toEqual(before.members);
        expect(undone.entries.map((posted) => posted.entry)).toEqual(
          before.entries.map((posted) => posted.entry),
        );
      }),
    );
  });
});
