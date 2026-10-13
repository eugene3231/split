import { describe, expect, it } from 'vitest';
import type { Person, Receipt, ReceiptSplit } from '@shared/types';
import { computeSplit, consolidateSplits } from '@features/split-workspace/logic/split/split';
import { equalShares } from '@features/split-workspace/logic/assignment';
import { makeItem, makeReceipt, percentCharge } from '../../../../tests/integration/testHelpers';

const people: Person[] = [
  { id: 'alice', name: 'Alice' },
  { id: 'bob', name: 'Bob' },
];

const rates = { SGD: 1, USD: 1.35, THB: 0.038 };

/** A receipt with one item that one person had, paired with its split. */
function receiptFor(
  personId: string,
  amountInput: string,
  overrides: Partial<Receipt> = {},
): ReceiptSplit {
  const receipt = makeReceipt({
    items: [makeItem({ amountInput, assignment: equalShares([personId]) })],
    ...overrides,
  });
  return { receipt, split: computeSplit(receipt, people) };
}

describe('consolidateSplits — same currency', () => {
  it('sums totals across two SGD receipts without conversion', () => {
    const consolidated = consolidateSplits(
      [receiptFor('alice', '10.00'), receiptFor('bob', '20.00')],
      { SGD: 1 },
    );

    expect(consolidated.totals.totalCents).toBe(3000);
    expect(consolidated.byPerson.alice.totalCents).toBe(1000);
    expect(consolidated.byPerson.bob.totalCents).toBe(2000);
  });

  it("lists each person's items from every receipt, in receipt order", () => {
    const consolidated = consolidateSplits(
      [
        receiptFor('alice', '10.00', {
          items: [makeItem({ id: 'soup', name: 'Soup', assignment: equalShares(['alice']) })],
        }),
        receiptFor('alice', '20.00', {
          items: [makeItem({ id: 'tea', name: 'Tea', assignment: equalShares(['bob']) })],
        }),
      ],
      { SGD: 1 },
    );

    expect(consolidated.byPerson.alice.lines).toEqual([
      { itemId: 'soup', name: 'Soup', amountCents: 1000 },
      { itemId: 'tea', name: 'Tea', amountCents: null },
    ]);
  });
});

describe('consolidateSplits — multi-currency', () => {
  it('converts a USD receipt to SGD before summing with a SGD receipt', () => {
    const consolidated = consolidateSplits(
      [receiptFor('alice', '10.00'), receiptFor('bob', '20.00', { currency: 'USD' })],
      rates,
    );

    // Alice: 1000 SGD cents (no conversion)
    expect(consolidated.byPerson.alice.totalCents).toBe(1000);
    // Bob: 2000 USD cents * 1.35 = 2700 SGD cents
    expect(consolidated.byPerson.bob.totalCents).toBe(2700);
    expect(consolidated.totals.totalCents).toBe(3700);
  });

  it('converts THB receipt to SGD correctly', () => {
    // 10000 THB cents * 0.038 = 380 SGD cents
    const consolidated = consolidateSplits(
      [receiptFor('alice', '100.00', { currency: 'THB' })],
      rates,
    );

    expect(consolidated.byPerson.alice.totalCents).toBe(380);
    expect(consolidated.totals.totalCents).toBe(380);
  });

  it('applies user exchange rate override instead of auto rate', () => {
    const withAutoRate = consolidateSplits(
      [receiptFor('alice', '10.00', { currency: 'USD' })],
      rates,
    );
    const withOverride = consolidateSplits(
      [receiptFor('alice', '10.00', { currency: 'USD', exchangeRateOverride: 1.5 })],
      rates,
    );

    expect(withAutoRate.byPerson.alice.totalCents).toBe(1350); // 1000 * 1.35
    expect(withOverride.byPerson.alice.totalCents).toBe(1500); // 1000 * 1.50
  });

  it('handles three receipts with three different currencies', () => {
    // SGD: 1000 cents
    // USD: 1000 cents * 1.35 = 1350 SGD cents
    // THB: 10000 cents * 0.038 = 380 SGD cents
    const consolidated = consolidateSplits(
      [
        receiptFor('alice', '10.00'),
        receiptFor('alice', '10.00', { currency: 'USD' }),
        receiptFor('alice', '100.00', { currency: 'THB' }),
      ],
      rates,
    );

    expect(consolidated.byPerson.alice.totalCents).toBe(2730);
    expect(consolidated.totals.totalCents).toBe(2730);
  });

  it('sums charges across receipts after currency conversion', () => {
    // 10000 USD subtotal * 1.35 = 13500 SGD cents
    // 1000 USD service * 1.35 = 1350 SGD cents
    const consolidated = consolidateSplits(
      [receiptFor('alice', '100.00', { currency: 'USD', serviceCharge: percentCharge('10') })],
      rates,
    );

    expect(consolidated.totals.subtotalCents).toBe(13500);
    expect(consolidated.totals.chargeCents.service).toBe(1350);
    expect(consolidated.totals.totalCents).toBe(14850);
  });

  it('adds up in another currency when asked to', () => {
    // 1350 SGD cents / 1.35 = 1000 USD cents, beside 1000 USD cents left as billed
    const consolidated = consolidateSplits(
      [receiptFor('alice', '13.50'), receiptFor('bob', '10.00', { currency: 'USD' })],
      rates,
      'USD',
    );

    expect(consolidated.byPerson.alice.totalCents).toBe(1000);
    expect(consolidated.byPerson.bob.totalCents).toBe(1000);
    expect(consolidated.totals.totalCents).toBe(2000);
  });
});
