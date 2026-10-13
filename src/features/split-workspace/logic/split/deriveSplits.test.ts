import { describe, expect, it } from 'vitest';
import type { Receipt } from '@shared/types';
import { deriveSplits } from '@features/split-workspace/logic/split/deriveSplits';
import { equalShares } from '@features/split-workspace/logic/assignment';
import type { NonEmptyArray } from '@features/split-workspace/logic/nonEmpty';
import { makeItem, makeReceipt } from '../../../../tests/integration/testHelpers';

const people = [
  { id: 'alice', name: 'Alice' },
  { id: 'bob', name: 'Bob' },
];
const rates = { SGD: 1, USD: 1.35 };

const lunch = makeReceipt({
  id: 'lunch',
  items: [makeItem({ amountInput: '10.00', assignment: equalShares(['alice']) })],
});
const dinner = makeReceipt({
  id: 'dinner',
  currency: 'USD',
  items: [makeItem({ amountInput: '20.00', assignment: equalShares(['alice', 'bob']) })],
});
const receipts: NonEmptyArray<Receipt> = [lunch, dinner];

describe('deriveSplits', () => {
  it('pairs each receipt with its own split, in the currency it was billed in', () => {
    const { receiptSplits } = deriveSplits(people, receipts, rates);

    expect(receiptSplits.map(({ receipt }) => receipt)).toEqual([lunch, dinner]);
    expect(receiptSplits[0].split.byPerson.alice.totalCents).toBe(1000);
    expect(receiptSplits[1].split.byPerson.bob.totalCents).toBe(1000);
  });

  it('adds every receipt up in the base currency', () => {
    const { consolidated } = deriveSplits(people, receipts, rates);

    // Alice: 10.00 SGD + 10.00 USD at 1.35. Bob: 10.00 USD at 1.35.
    expect(consolidated.byPerson.alice.totalCents).toBe(2350);
    expect(consolidated.byPerson.bob.totalCents).toBe(1350);
    expect(consolidated.totals.totalCents).toBe(3700);
  });

  it('hands every caller the same result until an input changes', () => {
    const first = deriveSplits(people, receipts, rates);

    expect(deriveSplits(people, receipts, rates)).toBe(first);
    expect(deriveSplits(people, receipts, { ...rates, USD: 1.4 })).not.toBe(first);
    expect(deriveSplits([...people], receipts, rates)).not.toBe(first);
    expect(deriveSplits(people, [lunch, dinner], rates)).not.toBe(first);
  });
});
