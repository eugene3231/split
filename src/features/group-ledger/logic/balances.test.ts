import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { MemberId } from '@features/group-ledger/domain/types';
import { computeBalances, entryEffect } from './balances';
import { asEntryId, asMemberId, asOpId } from './ids';
import {
  ana,
  ben,
  cat,
  confirmedOpsArb,
  created,
  dan,
  entryArb,
  fold,
  logOf,
  makeExpense,
  makeLog,
  makeMember,
  makeTransfer,
  memberIdArb,
  pending,
  pendingChangesArb,
  put,
} from './testHelpers';

const noAliases = new Map<MemberId, MemberId>();
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

describe('entryEffect', () => {
  it('credits the payer with what the others owe', () => {
    const entry = makeExpense('grab', { [ana]: 900, [ben]: 900 }, { payer: ana });

    expect(entryEffect(entry, noAliases)).toEqual({ ana: 900, ben: -900 });
  });

  it('credits a payer who owes nothing with the whole total', () => {
    const entry = makeExpense('gift', { [ben]: 1200, [cat]: 800 }, { payer: ana });

    expect(entryEffect(entry, noAliases)).toEqual({ ana: 2000, ben: -1200, cat: -800 });
  });

  it('credits several payers with what each put in', () => {
    const entry = makeExpense(
      'dinner',
      { [ana]: 1000, [ben]: 1000, [cat]: 1000 },
      { payer: ana, others: { [ben]: 500 } },
    );

    expect(entryEffect(entry, noAliases)).toEqual({ ana: 1500, ben: -500, cat: -1000 });
  });

  it('converts the total once at the frozen rate, then shares it out', () => {
    const entry = makeExpense(
      'ramen',
      { [ana]: 3333, [ben]: 3333, [cat]: 3334 },
      { payer: ana, currency: 'JPY', rate: 0.009 },
    );

    expect(entryEffect(entry, noAliases)).toEqual({ ana: 60, ben: -30, cat: -30 });
  });

  it('gives the cent a conversion leaves over to one member, so the entry still nets to zero', () => {
    const entry = makeExpense(
      'snack',
      { [ana]: 50, [ben]: 50 },
      { payer: cat, currency: 'USD', rate: 0.125 },
    );

    expect(entryEffect(entry, noAliases)).toEqual({ ana: -7, ben: -6, cat: 13 });
  });

  it('moves a transfer from the member who paid to the member who was paid', () => {
    expect(entryEffect(makeTransfer('paid', ben, ana, 300), noAliases)).toEqual({
      ana: -300,
      ben: 300,
    });
  });

  it('reads a merged-away member as the member they became', () => {
    const aliases = new Map([[ben, ana]]);
    const entry = makeExpense('grab', { [ana]: 500, [ben]: 500 }, { payer: cat });

    expect(entryEffect(entry, aliases)).toEqual({ ana: -1000, cat: 1000 });
    expect(entryEffect(makeTransfer('paid', ben, cat, 300), aliases)).toEqual({
      ana: 300,
      cat: -300,
    });
    expect(entryEffect(makeTransfer('self', ben, ana, 300), aliases)).toEqual({ ana: 0 });
  });
});

describe('computeBalances', () => {
  const eve = asMemberId('eve');
  const dinner = makeExpense('dinner', { [ana]: 1000, [ben]: 1000, [dan]: 1000 }, { payer: ana });

  it('adds every entry up per member, listing an archived member only while they are not square', () => {
    const ledger = fold(
      logOf(
        created,
        put(makeMember(ana)),
        put(makeMember(ben)),
        put(makeMember(cat)),
        put(makeMember(dan)),
        put(makeMember(eve)),
        { kind: 'entry.put', entry: dinner, base: null },
        { kind: 'entry.put', entry: makeTransfer('paid', ben, ana, 400), base: null },
        put(makeMember(dan, { archived: true })),
        put(makeMember(eve, { archived: true })),
      ),
    );

    expect(computeBalances(ledger)).toEqual({ ana: 1600, ben: -600, cat: 0, dan: -1000 });
  });

  it('leaves out an entry that was removed and counts an edit once', () => {
    const edited = makeExpense('dinner', { [ana]: 500, [ben]: 500 }, { payer: ben });
    const ledger = fold(
      logOf(
        created,
        put(makeMember(ana)),
        put(makeMember(ben)),
        { kind: 'entry.put', entry: dinner, base: null },
        { kind: 'entry.put', entry: makeTransfer('paid', ben, ana, 400), base: null },
        { kind: 'entry.put', entry: edited, base: null },
        { kind: 'entry.removed', entryId: asEntryId('paid'), base: asOpId('c5') },
      ),
    );

    expect(computeBalances(ledger)).toEqual({ ana: -500, ben: 500 });
  });

  it('moves a merged-away member’s balance to the member they became', () => {
    const ledger = fold(
      logOf(
        created,
        put(makeMember(ana)),
        put(makeMember(ben)),
        put(makeMember(dan)),
        { kind: 'entry.put', entry: dinner, base: null },
        { kind: 'member.merged', from: dan, into: ben },
      ),
    );

    expect(computeBalances(ledger)).toEqual({ ana: 2000, ben: -2000 });
  });
});

describe('balance properties', () => {
  it('nets every entry to exactly zero, whatever the rate and whoever was merged', () => {
    fc.assert(
      fc.property(
        entryArb,
        fc.double({ min: 0.00001, max: 20_000, noNaN: true }),
        fc.option(fc.tuple(memberIdArb, memberIdArb), { nil: null }),
        (entry, rate, merge) => {
          const aliases =
            merge === null || merge[0] === merge[1] ? noAliases : new Map([[merge[0], merge[1]]]);
          const effect = entryEffect(
            entry.kind === 'expense' ? { ...entry, rate } : entry,
            aliases,
          );

          expect(sum(Object.values(effect))).toBe(0);
          expect(Object.keys(effect).some((id) => aliases.has(asMemberId(id)))).toBe(false);
        },
      ),
    );
  });

  it('adds the balances of any group up to exactly zero', () => {
    fc.assert(
      fc.property(confirmedOpsArb, pendingChangesArb, (ops, changes) => {
        const ledger = fold(
          makeLog(
            ops,
            changes.map((change, index) => pending(index, change)),
          ),
        );

        expect(sum(Object.values(computeBalances(ledger)))).toBe(0);
      }),
    );
  });
});
