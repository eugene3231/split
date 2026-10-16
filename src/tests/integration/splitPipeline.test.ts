import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { EditableItem, Person, Receipt, SplitResult } from '@shared/types';
import { useSplits } from '@features/split-workspace/hooks/useSplits';
import {
  selectActiveReceipt,
  useReceiptStore,
} from '@features/split-workspace/stores/receiptStore';
import {
  computeReceiptTotals,
  resolveReconciliation,
} from '@features/split-workspace/logic/reconciliation';
import { NOBODY, equalShares, makeAssignment } from '@features/split-workspace/logic/assignment';
import { centsByPerson } from '@features/split-workspace/logic/split/amounts';
import {
  amountCharge,
  makeItem,
  makeReceipt,
  percentCharge,
  resetAllStores,
  seedStore,
  sumValues,
} from './testHelpers';

beforeEach(resetAllStores);

const alice = { id: 'alice', name: 'Alice' };
const bob = { id: 'bob', name: 'Bob' };
const cara = { id: 'cara', name: 'Cara' };

function solo(person: Person, amountInput: string, discountPercentInput = ''): EditableItem {
  return makeItem({ amountInput, discountPercentInput, assignment: equalShares([person.id]) });
}

function shared(people: Person[], amountInput: string, weights?: number[]): EditableItem {
  return makeItem({
    amountInput,
    assignment: weights
      ? makeAssignment(Object.fromEntries(people.map((person, i) => [person.id, weights[i]])))
      : equalShares(people.map((person) => person.id)),
  });
}

/** The splits as the app derives them from the store, with the active receipt's picked out. */
function renderSplits(people: Person[], receipts: Receipt[], rates?: Record<string, number>) {
  seedStore(people, receipts, rates && { exchangeRates: rates });
  return renderHook(() => {
    const { receiptSplits, consolidated } = useSplits();
    const activeId = useReceiptStore(selectActiveReceipt).id;
    const active = receiptSplits.find(({ receipt }) => receipt.id === activeId);
    if (!active) throw new Error('The active receipt has no split');
    return { active: active.split, consolidated };
  }).result;
}

function reconcileActiveReceipt() {
  const state = useReceiptStore.getState();
  return resolveReconciliation(selectActiveReceipt(state), state.people);
}

/** Each person's total by name, after checking they add up to the receipt's. */
function totalsByName(split: SplitResult, people: Person[]) {
  const totals = centsByPerson(split, 'total');
  expect(sumValues(totals)).toBe(split.totals.totalCents);
  return Object.fromEntries(people.map((person) => [person.name, totals[person.id]]));
}

describe('Split pipeline integration', () => {
  it.each<{ scenario: string; people: Person[]; receipt: Partial<Receipt>; totals: object }>([
    {
      scenario: 'charges each person for their own items',
      people: [alice, bob],
      receipt: { items: [solo(alice, '10.00'), solo(bob, '20.00')] },
      totals: { Alice: 1000, Bob: 2000 },
    },
    {
      scenario: 'gives the odd cent of a three-way split to one person',
      people: [alice, bob, cara],
      receipt: { items: [shared([alice, bob, cara], '10.00')] },
      totals: { Alice: 334, Bob: 333, Cara: 333 },
    },
    {
      scenario: 'adds GST on top of the service charge',
      people: [alice, bob],
      receipt: {
        items: [solo(alice, '10.00'), solo(bob, '20.00')],
        serviceCharge: percentCharge('10'),
        gst: percentCharge('9'),
      },
      // Service $3.00 on $30, then GST $2.97 on $33, each shared 1:2.
      totals: { Alice: 1199, Bob: 2398 },
    },
    {
      scenario: 'takes a fixed receipt discount off in proportion to each subtotal',
      people: [alice, bob],
      receipt: {
        items: [solo(alice, '10.00'), solo(bob, '30.00')],
        discount: amountCharge('4.00'),
      },
      totals: { Alice: 900, Bob: 2700 },
    },
    {
      scenario: 'takes a percent receipt discount off everyone',
      people: [alice, bob],
      receipt: { items: [solo(alice, '10.00'), solo(bob, '10.00')], discount: percentCharge('20') },
      totals: { Alice: 800, Bob: 800 },
    },
    {
      scenario: 'takes an item discount off that item only',
      people: [alice, bob],
      receipt: { items: [solo(alice, '10.00', '50'), solo(bob, '10.00')] },
      totals: { Alice: 500, Bob: 1000 },
    },
    {
      scenario: 'applies the receipt discount after item discounts',
      people: [alice, bob],
      receipt: {
        items: [solo(alice, '10.00', '50'), solo(bob, '10.00')],
        discount: amountCharge('3.00'),
      },
      totals: { Alice: 400, Bob: 800 },
    },
    {
      scenario: 'spreads a fixed service charge by subtotal',
      people: [alice, bob],
      receipt: {
        items: [solo(alice, '10.00'), solo(bob, '20.00')],
        serviceCharge: amountCharge('3.00'),
      },
      totals: { Alice: 1100, Bob: 2200 },
    },
    {
      scenario: 'splits a weighted item and its service charge 2:1',
      people: [alice, bob],
      receipt: {
        items: [shared([alice, bob], '30.00', [2, 1])],
        serviceCharge: percentCharge('10'),
      },
      totals: { Alice: 2200, Bob: 1100 },
    },
    {
      scenario: 'reads percent weights the same as their reduced shares',
      people: [alice, bob],
      receipt: { items: [shared([alice, bob], '30.00', [60, 40])] },
      totals: { Alice: 1800, Bob: 1200 },
    },
    {
      scenario: 'charges a half-claimed item to its one claimant at half price',
      people: [alice, bob],
      receipt: {
        items: [makeItem({ amountInput: '10.00', assignment: makeAssignment({ alice: 1 }, 1) })],
      },
      totals: { Alice: 500, Bob: 0 },
    },
    {
      scenario: 'splits rounding evenly between the people on the receipt',
      people: [alice, bob, cara],
      receipt: { items: [solo(alice, '10.00'), solo(bob, '20.00')], roundingInput: '0.03' },
      totals: { Alice: 1002, Bob: 2001, Cara: 0 },
    },
    {
      scenario: 'charges nothing to someone who had nothing',
      people: [alice, bob],
      receipt: { items: [solo(alice, '10.00')] },
      totals: { Alice: 1000, Bob: 0 },
    },
    {
      scenario: 'skips zero-priced and fully discounted items',
      people: [alice, bob],
      receipt: { items: [solo(alice, '0'), solo(alice, '5.00', '100'), solo(bob, '10.00')] },
      totals: { Alice: 0, Bob: 1000 },
    },
    {
      scenario: 'never charges below zero when the discount is larger than the bill',
      people: [alice, bob],
      receipt: { items: [solo(alice, '5.00')], discount: amountCharge('10.00') },
      totals: { Alice: 0, Bob: 0 },
    },
    {
      scenario: 'leaves out an item whose people are no longer in the split',
      people: [alice, bob],
      receipt: { items: [makeItem({ amountInput: '10.00', assignment: equalShares(['gone']) })] },
      totals: { Alice: 0, Bob: 0 },
    },
  ])('$scenario', ({ people, receipt, totals }) => {
    const result = renderSplits(people, [makeReceipt(receipt)]);

    expect(totalsByName(result.current.active, people)).toEqual(totals);
  });

  describe('multiple receipts', () => {
    it('computes charges per receipt, then adds the receipts up', () => {
      const lunch = makeReceipt({
        items: [solo(alice, '10.00')],
        serviceCharge: percentCharge('10'),
      });
      const dinner = makeReceipt({ items: [solo(bob, '20.00')], gst: percentCharge('9') });

      const { consolidated } = renderSplits([alice, bob], [lunch, dinner]).current;

      expect(totalsByName(consolidated, [alice, bob])).toEqual({ Alice: 1100, Bob: 2180 });
      expect(consolidated.totals.chargeCents).toEqual({
        discount: 0,
        service: 100,
        gst: 180,
        rounding: 0,
      });
    });

    it('converts a foreign receipt to SGD before adding it', () => {
      const local = makeReceipt({ items: [solo(alice, '10.00')] });
      const abroad = makeReceipt({ items: [solo(bob, '20.00')], currency: 'USD' });

      const { consolidated } = renderSplits([alice, bob], [local, abroad], {
        SGD: 1,
        USD: 1.35,
      }).current;

      expect(totalsByName(consolidated, [alice, bob])).toEqual({ Alice: 1000, Bob: 2700 });
    });

    it('re-totals when the user overrides the exchange rate', () => {
      const local = makeReceipt({ items: [solo(alice, '10.00')] });
      const abroad = makeReceipt({ items: [solo(bob, '10.00')], currency: 'USD' });
      const result = renderSplits([alice, bob], [local, abroad], { SGD: 1, USD: 1.35 });
      expect(result.current.consolidated.totals.totalCents).toBe(2350);

      act(() => useReceiptStore.getState().patchReceipt(abroad.id, { exchangeRateOverride: 1.5 }));

      expect(result.current.consolidated.totals.totalCents).toBe(2500);
    });
  });

  describe('reconciliation against the printed total', () => {
    it.each([
      ['10.00', 0],
      ['', null],
    ])('reports the gap to a receipt total of %j as %j', (receiptTotalInput, cents) => {
      seedStore([alice], [makeReceipt({ items: [solo(alice, '10.00')], receiptTotalInput })]);

      expect(reconcileActiveReceipt().cents).toBe(cents);
    });

    it('discounts an overcharge down to the printed total', () => {
      const receipt = makeReceipt({ items: [solo(alice, '10.00')], receiptTotalInput: '8.00' });
      const result = renderSplits([alice, bob], [receipt]);
      const { cents, fix } = reconcileActiveReceipt();
      expect(cents).toBe(-200);
      if (!fix) throw new Error('Expected a corrective discount');

      act(() => useReceiptStore.getState().patchReceipt(receipt.id, fix));

      expect(result.current.active.totals.totalCents).toBe(800);
      expect(reconcileActiveReceipt().cents).toBe(0);
    });

    it('counts unclaimed items in receipt totals and reconciliation, not in the split', () => {
      const receipt = makeReceipt({
        items: [solo(alice, '10.00'), makeItem({ amountInput: '20.00', assignment: NOBODY })],
        receiptTotalInput: '30.00',
      });

      const result = renderSplits([alice, bob], [receipt]);

      expect(computeReceiptTotals(receipt, [alice, bob]).totalCents).toBe(3000);
      expect(reconcileActiveReceipt().cents).toBe(0);
      expect(totalsByName(result.current.active, [alice, bob])).toEqual({ Alice: 1000, Bob: 0 });
    });
  });
});
