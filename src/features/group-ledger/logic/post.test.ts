import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { ChargeState, EditableItem } from '@shared/types';
import { makeAssignment } from '@features/split-workspace/logic/assignment';
import { computeSplit } from '@features/split-workspace/logic/split/split';
import type { StoredReceipt } from '@features/group-ledger/domain/types';
import { asEntryId, asLocalDate } from './ids';
import { parseChange } from './codec';
import {
  keepSavedCents,
  paidBy,
  postAmounts,
  postReceipt,
  postWeights,
  totalCents,
  type ExpenseHeader,
} from './post';
import { ana, ben, cat, makeExpense, makeMember } from './testHelpers';

const header: ExpenseHeader = {
  id: asEntryId('e1'),
  title: 'Dinner',
  date: asLocalDate('2026-11-19'),
  currency: 'SGD',
  rate: 1,
  payment: { payer: ana, others: {} },
};

const noCharge: ChargeState = {
  enabled: false,
  mode: 'percent',
  amountInput: '',
  percentInput: '',
  detectedConfidence: null,
  detectedSource: null,
};

function makeItem(id: string, amountInput: string, shares: Record<string, number>, unassigned = 0) {
  return {
    id,
    name: id,
    amountInput,
    discountPercentInput: '',
    assignment: makeAssignment(shares, unassigned),
  } satisfies EditableItem;
}

function makeReceipt(overrides: Partial<StoredReceipt>): StoredReceipt {
  return {
    id: 'r1',
    name: 'Dinner',
    items: [],
    discount: noCharge,
    serviceCharge: noCharge,
    gst: noCharge,
    receiptTotalInput: '',
    roundingInput: '',
    currency: 'SGD',
    exchangeRateOverride: null,
    ...overrides,
  };
}

const members = [makeMember(ana), makeMember(ben), makeMember(cat)];

describe('postWeights', () => {
  it('splits evenly between everyone with a weight of 1, the spare cent to the first id', () => {
    const entry = postWeights(header, 1000, { [ana]: 1, [ben]: 1, [cat]: 1 });

    expect(entry).toEqual({
      kind: 'expense',
      ...header,
      owed: { ana: 334, ben: 333, cat: 333 },
      basis: { kind: 'weights', weights: { ana: 1, ben: 1, cat: 1 } },
    });
  });

  it('splits by share weights and leaves out a member with no weight', () => {
    const entry = postWeights(header, 900, { [ana]: 2, [ben]: 1, [cat]: 0 });

    expect(entry?.owed).toEqual({ ana: 600, ben: 300 });
    expect(entry?.basis).toEqual({ kind: 'weights', weights: { ana: 2, ben: 1 } });
  });

  it('keeps the weight of a member whose share rounds to nothing, so the form reopens with them', () => {
    const entry = postWeights(header, 1, { [ana]: 1, [ben]: 1 });

    expect(entry?.owed).toEqual({ ana: 1 });
    expect(entry?.basis).toEqual({ kind: 'weights', weights: { ana: 1, ben: 1 } });
  });

  it('posts nothing until there is a total and somebody to split it between', () => {
    expect(postWeights(header, 0, { [ana]: 1 })).toBeNull();
    expect(postWeights(header, -500, { [ana]: 1 })).toBeNull();
    expect(postWeights(header, 1000, {})).toBeNull();
    expect(postWeights(header, 1000, { [ana]: 0 })).toBeNull();
  });
});

describe('postAmounts', () => {
  it('keeps the typed amounts and drops members who owe nothing', () => {
    const entry = postAmounts(header, { [ana]: 1250, [ben]: 0, [cat]: 750 });

    expect(entry?.owed).toEqual({ ana: 1250, cat: 750 });
    expect(entry?.basis).toEqual({ kind: 'amounts' });
  });

  it('posts nothing until somebody owes something', () => {
    expect(postAmounts(header, {})).toBeNull();
    expect(postAmounts(header, { [ana]: 0 })).toBeNull();
  });
});

describe('postReceipt', () => {
  it('freezes what each member owes on an itemised receipt, charges included', () => {
    const receipt = makeReceipt({
      items: [
        makeItem('ramen', '10.00', { [ana]: 1 }),
        makeItem('gyoza', '6.00', { [ana]: 1, [ben]: 1 }),
      ],
      serviceCharge: { ...noCharge, enabled: true, percentInput: '10' },
    });

    const entry = postReceipt(header, receipt, members);

    expect(entry?.owed).toEqual({ ana: 1430, ben: 330 });
    expect(entry?.basis).toEqual({ kind: 'receipt', receipt });
  });

  it('stores the receipt without the photo the wizard holds, so the codec reads the entry back', () => {
    const fromTheWizard = {
      ...makeReceipt({ items: [makeItem('ramen', '10.00', { [ana]: 1 })] }),
      receiptFile: null,
    };

    const entry = postReceipt(header, fromTheWizard, members);
    const change = { kind: 'entry.put', entry, base: null };

    expect(entry).not.toBeNull();
    expect(parseChange(JSON.parse(JSON.stringify(change)))).toEqual(change);
  });

  it('posts nothing while a priced item has nobody on it', () => {
    const receipt = makeReceipt({
      items: [makeItem('ramen', '10.00', { [ana]: 1 }), makeItem('gyoza', '6.00', {})],
    });

    expect(postReceipt(header, receipt, members)).toBeNull();
  });

  it('posts nothing while part of a priced item is still unassigned', () => {
    const receipt = makeReceipt({ items: [makeItem('ramen', '10.00', { [ana]: 1 }, 1)] });

    expect(postReceipt(header, receipt, members)).toBeNull();
  });

  it('posts nothing while an item is only on someone who is not a member', () => {
    const receipt = makeReceipt({ items: [makeItem('ramen', '10.00', { stranger: 1 })] });

    expect(postReceipt(header, receipt, members)).toBeNull();
  });

  it('ignores an unassigned item that has no price yet', () => {
    const receipt = makeReceipt({
      items: [makeItem('ramen', '10.00', { [ben]: 1 }), makeItem('blank', '', {})],
    });

    expect(postReceipt(header, receipt, members)?.owed).toEqual({ ben: 1000 });
  });

  it('posts nothing for a receipt that comes to nothing', () => {
    expect(postReceipt(header, makeReceipt({ items: [] }), members)).toBeNull();
    expect(
      postReceipt(header, makeReceipt({ items: [makeItem('free', '0', { [ana]: 1 })] }), members),
    ).toBeNull();
  });

  it('posts nothing when rounding would leave a member owing less than nothing', () => {
    const receipt = makeReceipt({
      items: [makeItem('sweet', '0.10', { [ana]: 1 }), makeItem('ramen', '10.00', { [ben]: 1 })],
      roundingInput: '-0.50',
    });

    expect(postReceipt(header, receipt, members)).toBeNull();
  });
});

describe('totalCents and paidBy', () => {
  it('adds up what everyone owes', () => {
    expect(totalCents(makeExpense('e1', { [ana]: 1250, [ben]: 750 }))).toBe(2000);
  });

  it('has a single payer cover the whole total', () => {
    expect(paidBy(makeExpense('e1', { [ana]: 1250, [ben]: 750 }, { payer: ben }))).toEqual({
      ben: 2000,
    });
  });

  it('has the payer cover the total less what the others put in', () => {
    const entry = makeExpense(
      'e1',
      { [ana]: 3000 },
      { payer: ana, others: { [ben]: 500, [cat]: 700 } },
    );

    expect(paidBy(entry)).toEqual({ ana: 1800, ben: 500, cat: 700 });
  });

  it('never counts more than the total: the others are capped in id order and the payer adds nothing', () => {
    const entry = makeExpense(
      'e1',
      { [ana]: 1000 },
      { payer: ana, others: { [cat]: 900, [ben]: 800 } },
    );

    expect(paidBy(entry)).toEqual({ ben: 800, cat: 200 });
  });
});

const people = ['ana', 'ben', 'cat'];
const money = (maxCents: number) =>
  fc.integer({ min: 0, max: maxCents }).map((cents) => (cents / 100).toFixed(2));

const chargeArb = (maxPercent: number): fc.Arbitrary<ChargeState> =>
  fc.record({
    enabled: fc.boolean(),
    mode: fc.constantFrom('percent' as const, 'amount' as const),
    percentInput: fc.integer({ min: 0, max: maxPercent }).map(String),
    amountInput: money(2_000),
    detectedConfidence: fc.constant(null),
    detectedSource: fc.constant(null),
  });

const assignedReceiptArb: fc.Arbitrary<StoredReceipt> = fc
  .record({
    items: fc.array(
      fc.record({
        amountInput: money(50_000),
        discountPercentInput: fc.constantFrom('', '10', '100'),
        shares: fc.dictionary(fc.constantFrom(...people), fc.integer({ min: 1, max: 5 }), {
          minKeys: 1,
        }),
      }),
      { minLength: 1, maxLength: 6 },
    ),
    discount: chargeArb(100),
    serviceCharge: chargeArb(20),
    gst: chargeArb(10),
    roundingInput: fc.integer({ min: -9, max: 9 }).map((cents) => (cents / 100).toFixed(2)),
  })
  .map(({ items, ...charges }) =>
    makeReceipt({
      ...charges,
      items: items.map(({ shares, ...item }, index) => ({
        ...item,
        id: `i${index}`,
        name: 'Item',
        assignment: makeAssignment(shares),
      })),
    }),
  );

describe('postReceipt properties', () => {
  it('owes, between everyone, exactly what the split engine says the receipt comes to', () => {
    fc.assert(
      fc.property(assignedReceiptArb, (receipt) => {
        const split = computeSplit(receipt, members);
        const entry = postReceipt(header, receipt, members);
        const totals = members.map((member) => split.byPerson[member.id].totalCents);

        if (entry === null) {
          expect(split.totals.totalCents <= 0 || totals.some((cents) => cents < 0)).toBe(true);
          return;
        }
        expect(totalCents(entry)).toBe(split.totals.totalCents);
        for (const member of members) {
          expect(entry.owed[member.id] ?? 0).toBe(split.byPerson[member.id].totalCents);
        }
      }),
    );
  });

  it('pays in exactly the total, whatever the others are said to have put in', () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.constantFrom(ana, ben, cat), fc.integer({ min: 1, max: 100_000 }), {
          minKeys: 1,
        }),
        fc.dictionary(fc.constantFrom(ben, cat), fc.integer({ min: 1, max: 150_000 })),
        (owed, others) => {
          const entry = makeExpense('e1', owed, { payer: ana, others });
          const paid = Object.values(paidBy(entry));

          expect(paid.reduce((sum, cents) => sum + cents, 0)).toBe(totalCents(entry));
          expect(paid.every((cents) => cents > 0)).toBe(true);
        },
      ),
    );
  });
});

describe('keepSavedCents', () => {
  const receipt = makeReceipt({ items: [makeItem('a', '10.01', { [ana]: 1, [ben]: 1 })] });
  const saved = postReceipt(header, receipt, members)!;
  const movedCent = { ...saved, owed: { [ana]: 500, [ben]: 501 } };

  it('keeps the cents a receipt was saved with when only its name or payer changed', () => {
    const renamed = postReceipt(
      { ...header, title: 'Supper', payment: { payer: ben, others: {} } },
      { ...receipt, name: 'Supper' },
      members,
    )!;

    expect(keepSavedCents(renamed, movedCent).owed).toEqual(movedCent.owed);
  });

  it('splits the receipt again once an item changes', () => {
    const changed = postReceipt(
      header,
      { ...receipt, items: [makeItem('a', '12.00', { [ana]: 1, [ben]: 1 })] },
      members,
    )!;

    expect(keepSavedCents(changed, movedCent).owed).toEqual(changed.owed);
  });

  it('leaves a new receipt as posted', () => {
    expect(keepSavedCents(saved, null)).toBe(saved);
  });
});
