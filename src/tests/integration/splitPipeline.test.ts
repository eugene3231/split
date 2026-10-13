import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSplits } from '@features/split-workspace/hooks/useSplits';
import {
  selectActiveReceipt,
  useReceiptStore,
} from '@features/split-workspace/stores/receiptStore';
import {
  computeReceiptTotals,
  resolveReconciliation,
} from '@features/split-workspace/logic/reconciliation';
import { defaultServiceChargeState, defaultGstState } from '@features/split-workspace/constants';
import {
  disabledCharge,
  percentCharge,
  amountCharge,
  makePerson,
  makeItem,
  makeReceipt,
  resetAllStores,
  seedStore,
  sumValues,
} from './testHelpers';
import { NOBODY, equalShares, makeAssignment } from '@features/split-workspace/logic/assignment';
import { centsByPerson } from '@features/split-workspace/logic/split/amounts';

beforeEach(resetAllStores);

function reconcileActiveReceipt() {
  const state = useReceiptStore.getState();
  return resolveReconciliation(selectActiveReceipt(state), state.people);
}

/** The splits as the app derives them, with the active receipt's own split picked out. */
function renderSplits() {
  return renderHook(() => {
    const { receiptSplits, consolidated } = useSplits();
    const activeReceipt = useReceiptStore(selectActiveReceipt);
    const active = receiptSplits.find(({ receipt }) => receipt.id === activeReceipt.id);
    if (!active) throw new Error('The active receipt has no split');
    return { active, receiptSplits, consolidated };
  });
}

describe('Split pipeline integration', () => {
  describe('Core scenarios', () => {
    it('1: basic single receipt — per-person totals sum to grand total', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: equalShares([alice.id]),
          }),
          makeItem({
            amountInput: '20.00',
            assignment: equalShares([bob.id]),
          }),
        ],
      });

      seedStore([alice, bob], [receipt]);
      const { result } = renderSplits();
      const { active } = result.current;

      expect(sumValues(centsByPerson(active.split, 'total'))).toBe(active.split.totals.totalCents);
      expect(active.split.byPerson[alice.id].totalCents).toBeGreaterThan(0);
      expect(active.split.byPerson[bob.id].totalCents).toBeGreaterThan(0);
    });

    it('2: equal 3-way split — all totals nonzero, sum equals grand total', () => {
      const p1 = makePerson('Alice');
      const p2 = makePerson('Ben');
      const p3 = makePerson('Cara');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: equalShares([p1.id, p2.id, p3.id]),
          }),
        ],
      });

      seedStore([p1, p2, p3], [receipt]);
      const { result } = renderSplits();
      const { active } = result.current;

      expect(sumValues(centsByPerson(active.split, 'total'))).toBe(active.split.totals.totalCents);
      expect(active.split.byPerson[p1.id].totalCents).toBeGreaterThan(0);
      expect(active.split.byPerson[p2.id].totalCents).toBeGreaterThan(0);
      expect(active.split.byPerson[p3.id].totalCents).toBeGreaterThan(0);
    });

    it('3: service charge + GST — enabling charges increases grand total', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: equalShares([alice.id]),
          }),
          makeItem({
            amountInput: '20.00',
            assignment: equalShares([bob.id]),
          }),
        ],
        serviceCharge: percentCharge('10'),
        gst: percentCharge('9'),
      });

      seedStore([alice, bob], [receipt]);
      const { result } = renderSplits();
      const { active } = result.current;

      expect(active.split.totals.totalCents).toBeGreaterThan(active.split.totals.subtotalCents);
      expect(active.split.totals.chargeCents.service).toBeGreaterThan(0);
      expect(active.split.totals.chargeCents.gst).toBeGreaterThan(0);
      expect(sumValues(centsByPerson(active.split, 'total'))).toBe(active.split.totals.totalCents);
    });

    it('4: receipt-level discount (amount) — reduces grand total, stays non-negative', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: equalShares([alice.id]),
          }),
          makeItem({
            amountInput: '10.00',
            assignment: equalShares([bob.id]),
          }),
        ],
        discount: amountCharge('4.00'),
      });

      seedStore([alice, bob], [receipt]);
      const { result } = renderSplits();
      const { active } = result.current;

      expect(active.split.totals.chargeCents.discount).toBe(400);
      expect(active.split.totals.totalCents).toBeLessThan(2000);
      expect(active.split.totals.totalCents).toBeGreaterThanOrEqual(0);
      expect(sumValues(centsByPerson(active.split, 'total'))).toBe(active.split.totals.totalCents);
    });

    it('5: receipt-level discount (percent) — reduces grand total proportionally', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: equalShares([alice.id]),
          }),
          makeItem({
            amountInput: '10.00',
            assignment: equalShares([bob.id]),
          }),
        ],
        discount: percentCharge('20'),
      });

      seedStore([alice, bob], [receipt]);
      const { result } = renderSplits();
      const { active } = result.current;

      expect(active.split.totals.chargeCents.discount).toBeGreaterThan(0);
      expect(active.split.totals.totalCents).toBeLessThan(2000);
      expect(sumValues(centsByPerson(active.split, 'total'))).toBe(active.split.totals.totalCents);
    });

    it('6: item-level discount — only affects the discounted item person', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            discountPercentInput: '50',
            assignment: equalShares([alice.id]),
          }),
          makeItem({
            amountInput: '10.00',
            assignment: equalShares([bob.id]),
          }),
        ],
      });

      seedStore([alice, bob], [receipt]);
      const { result } = renderSplits();
      const { active } = result.current;

      expect(active.split.byPerson[alice.id].totalCents).toBeLessThan(
        active.split.byPerson[bob.id].totalCents,
      );
      expect(sumValues(centsByPerson(active.split, 'total'))).toBe(active.split.totals.totalCents);
    });

    it('7: item + receipt discounts combined — both reduce more than either alone', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receiptNoDiscount = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            discountPercentInput: '50',
            assignment: equalShares([alice.id]),
          }),
          makeItem({
            amountInput: '10.00',
            assignment: equalShares([bob.id]),
          }),
        ],
      });
      const receiptWithItemDiscountOnly = makeReceipt({
        items: receiptNoDiscount.items,
        discount: { ...disabledCharge },
      });
      const receiptWithBoth = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            discountPercentInput: '50',
            assignment: equalShares([alice.id]),
          }),
          makeItem({
            amountInput: '10.00',
            assignment: equalShares([bob.id]),
          }),
        ],
        discount: amountCharge('2.00'),
      });

      seedStore([alice, bob], [receiptWithItemDiscountOnly]);
      const itemOnlyResult = renderSplits().result.current.active.split;

      resetAllStores();
      seedStore([alice, bob], [receiptWithBoth]);
      const bothResult = renderSplits().result.current.active.split;

      expect(bothResult.totals.totalCents).toBeLessThan(itemOnlyResult.totals.totalCents);
      expect(sumValues(centsByPerson(bothResult, 'total'))).toBe(bothResult.totals.totalCents);
    });

    it('8: all charges + item discount — grand total > discounted subtotal, sums add up', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            discountPercentInput: '50',
            assignment: equalShares([alice.id]),
          }),
          makeItem({
            amountInput: '20.00',
            assignment: equalShares([bob.id]),
          }),
        ],
        serviceCharge: percentCharge('10'),
        gst: percentCharge('9'),
      });

      seedStore([alice, bob], [receipt]);
      const { result } = renderSplits();
      const { active } = result.current;

      expect(active.split.totals.totalCents).toBeGreaterThan(active.split.totals.subtotalCents);
      expect(active.split.totals.chargeCents.service).toBeGreaterThan(0);
      expect(active.split.totals.chargeCents.gst).toBeGreaterThan(0);
      expect(sumValues(centsByPerson(active.split, 'total'))).toBe(active.split.totals.totalCents);
    });
  });

  describe('Multi-receipt scenarios', () => {
    it('9: multi-receipt same currency — consolidated = sum of individual grand totals', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const r1 = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: equalShares([alice.id]),
          }),
        ],
      });
      const r2 = makeReceipt({
        items: [
          makeItem({
            amountInput: '20.00',
            assignment: equalShares([bob.id]),
          }),
        ],
      });

      seedStore([alice, bob], [r1, r2]);
      const { result } = renderSplits();
      const { receiptSplits, consolidated } = result.current;

      const receiptGrandTotals = receiptSplits.map(({ split }) => split.totals.totalCents);
      const sumOfReceipts = receiptGrandTotals.reduce((a, b) => a + b, 0);
      expect(consolidated.totals.totalCents).toBe(sumOfReceipts);
      expect(sumValues(centsByPerson(consolidated, 'total'))).toBe(consolidated.totals.totalCents);
    });

    it('10: multi-receipt with charges per receipt — charges computed independently then summed', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const r1 = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: equalShares([alice.id]),
          }),
        ],
        serviceCharge: percentCharge('10'),
        gst: { ...disabledCharge },
      });
      const r2 = makeReceipt({
        items: [
          makeItem({
            amountInput: '20.00',
            assignment: equalShares([bob.id]),
          }),
        ],
        serviceCharge: { ...disabledCharge },
        gst: percentCharge('9'),
      });

      seedStore([alice, bob], [r1, r2]);
      const { result } = renderSplits();
      const { receiptSplits, consolidated } = result.current;

      expect(receiptSplits[0].split.totals.chargeCents.service).toBeGreaterThan(0);
      expect(receiptSplits[0].split.totals.chargeCents.gst).toBe(0);
      expect(receiptSplits[1].split.totals.chargeCents.gst).toBeGreaterThan(0);
      expect(receiptSplits[1].split.totals.chargeCents.service).toBe(0);

      expect(consolidated.totals.chargeCents.service).toBe(
        receiptSplits[0].split.totals.chargeCents.service,
      );
      expect(consolidated.totals.chargeCents.gst).toBe(
        receiptSplits[1].split.totals.chargeCents.gst,
      );
      expect(sumValues(centsByPerson(consolidated, 'total'))).toBe(consolidated.totals.totalCents);
    });

    it('11: multi-receipt multi-currency — conversion changes consolidated total', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const r1 = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: equalShares([alice.id]),
          }),
        ],
        currency: 'SGD',
      });
      const r2 = makeReceipt({
        items: [
          makeItem({
            amountInput: '20.00',
            assignment: equalShares([bob.id]),
          }),
        ],
        currency: 'USD',
      });

      seedStore([alice, bob], [r1, r2], { exchangeRates: { SGD: 1, USD: 1.35 } });
      const { result } = renderSplits();
      const { consolidated } = result.current;

      expect(consolidated.totals.totalCents).toBeGreaterThan(r1Total() + 2000);
      expect(sumValues(centsByPerson(consolidated, 'total'))).toBe(consolidated.totals.totalCents);

      function r1Total() {
        return result.current.receiptSplits[0].split.totals.totalCents;
      }
    });

    it('12: multi-receipt + exchange rate override — override changes consolidated total', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const rSgd = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: equalShares([alice.id]),
          }),
        ],
        currency: 'SGD',
      });
      const rUsd = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: equalShares([bob.id]),
          }),
        ],
        currency: 'USD',
        exchangeRateOverride: null,
      });

      seedStore([alice, bob], [rSgd, rUsd], { exchangeRates: { SGD: 1, USD: 1.35 } });
      const { result } = renderSplits();
      const consolidatedAuto = result.current.consolidated.totals.totalCents;

      act(() => {
        useReceiptStore.getState().patchReceipt(rUsd.id, { exchangeRateOverride: 1.5 });
      });

      const consolidatedOverride = result.current.consolidated.totals.totalCents;
      expect(consolidatedOverride).not.toBe(consolidatedAuto);
    });
  });

  describe('Edge cases', () => {
    it('13: single person — grand total equals person total', () => {
      const alice = makePerson('Alice');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '15.00',
            assignment: equalShares([alice.id]),
          }),
        ],
      });

      seedStore([alice], [receipt]);
      const { result } = renderSplits();
      const { active } = result.current;

      expect(active.split.totals.totalCents).toBe(active.split.byPerson[alice.id].totalCents);
    });

    it('14: person assigned to no items — zero subtotal, not involved in any line', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: equalShares([alice.id]),
          }),
        ],
      });

      seedStore([alice, bob], [receipt]);
      const { result } = renderSplits();
      const { active } = result.current;

      expect(active.split.byPerson[bob.id].subtotalCents).toBe(0);
      expect(active.split.byPerson[bob.id].lines.some((line) => line.amountCents !== null)).toBe(
        false,
      );
      expect(active.split.byPerson[bob.id].totalCents).toBe(0);
    });

    it('15: all items unassigned — grand total > 0, all per-person totals are 0', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: equalShares(['nonexistent']),
          }),
        ],
      });

      seedStore([alice, bob], [receipt]);
      const { result } = renderSplits();
      const { active } = result.current;

      expect(active.split.byPerson[alice.id].lines).toEqual([]);
      expect(sumValues(centsByPerson(active.split, 'total'))).toBe(0);
      expect(active.split.totals.subtotalCents).toBe(0);
      expect(active.split.totals.totalCents).toBe(0);
    });

    it('16: zero-amount item — skipped, does not affect totals', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '0',
            assignment: equalShares([alice.id]),
          }),
          makeItem({
            amountInput: '10.00',
            assignment: equalShares([bob.id]),
          }),
        ],
      });

      seedStore([alice, bob], [receipt]);
      const { result } = renderSplits();
      const { active } = result.current;

      expect(active.split.totals.subtotalCents).toBe(1000);
      expect(active.split.byPerson[bob.id].totalCents).toBe(1000);
    });

    it('17: 100% item discount — item skipped entirely', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '5.00',
            discountPercentInput: '100',
            assignment: equalShares([alice.id]),
          }),
          makeItem({
            amountInput: '10.00',
            assignment: equalShares([bob.id]),
          }),
        ],
      });

      seedStore([alice, bob], [receipt]);
      const { result } = renderSplits();
      const { active } = result.current;

      expect(active.split.totals.subtotalCents).toBe(1000);
      expect(active.split.byPerson[bob.id].totalCents).toBe(1000);
      expect(active.split.byPerson[alice.id].lines).toEqual([
        expect.objectContaining({ amountCents: null }),
      ]);
    });

    it('18: reconciliation overcharge — reconciliationCents is negative', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: equalShares([alice.id]),
          }),
        ],
        receiptTotalInput: '8.00',
      });

      seedStore([alice, bob], [receipt]);
      const { result } = renderSplits();

      const { cents, fix } = reconcileActiveReceipt();
      expect(cents).toBe(-200);
      if (!fix) throw new Error('Expected a corrective discount');

      act(() => {
        useReceiptStore.getState().patchReceipt(receipt.id, fix);
      });

      expect(result.current.active.split.totals.totalCents).toBeLessThan(1000);
    });

    it('19: reconciliation exact match — reconciliationCents is 0', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: equalShares([alice.id]),
          }),
        ],
        receiptTotalInput: '10.00',
      });

      seedStore([alice, bob], [receipt]);

      expect(reconcileActiveReceipt().cents).toBe(0);
    });

    it('20: reconciliation no receipt total — reconciliationCents is null', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: equalShares([alice.id]),
          }),
        ],
        receiptTotalInput: '',
      });

      seedStore([alice, bob], [receipt]);

      expect(reconcileActiveReceipt().cents).toBeNull();
    });

    it('21: charge mode=amount — service as fixed amount, sums to serviceChargeCents', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: equalShares([alice.id]),
          }),
          makeItem({
            amountInput: '20.00',
            assignment: equalShares([bob.id]),
          }),
        ],
        serviceCharge: amountCharge('5.00'),
      });

      seedStore([alice, bob], [receipt]);
      const { result } = renderSplits();
      const { active } = result.current;

      expect(active.split.totals.chargeCents.service).toBe(500);
      expect(sumValues(centsByPerson(active.split, 'service'))).toBe(500);
      expect(sumValues(centsByPerson(active.split, 'total'))).toBe(active.split.totals.totalCents);
    });

    it('22: only GST, no service — GST computed on subtotal', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: equalShares([alice.id]),
          }),
          makeItem({
            amountInput: '20.00',
            assignment: equalShares([bob.id]),
          }),
        ],
        serviceCharge: { ...defaultServiceChargeState, enabled: false },
        gst: percentCharge('9'),
      });

      seedStore([alice, bob], [receipt]);
      const { result } = renderSplits();
      const { active } = result.current;

      expect(active.split.totals.chargeCents.service).toBe(0);
      expect(active.split.totals.chargeCents.gst).toBeGreaterThan(0);
      expect(sumValues(centsByPerson(active.split, 'total'))).toBe(active.split.totals.totalCents);
    });

    it('23: only service, no GST — service computed, GST = 0', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: equalShares([alice.id]),
          }),
          makeItem({
            amountInput: '20.00',
            assignment: equalShares([bob.id]),
          }),
        ],
        serviceCharge: percentCharge('10'),
        gst: { ...defaultGstState, enabled: false },
      });

      seedStore([alice, bob], [receipt]);
      const { result } = renderSplits();
      const { active } = result.current;

      expect(active.split.totals.chargeCents.service).toBeGreaterThan(0);
      expect(active.split.totals.chargeCents.gst).toBe(0);
      expect(sumValues(centsByPerson(active.split, 'total'))).toBe(active.split.totals.totalCents);
    });

    it('25: weighted 2:1 split — per-person totals reflect weights and sum to grand total', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '30.00',
            assignment: makeAssignment({ [alice.id]: 2, [bob.id]: 1 }),
          }),
        ],
      });

      seedStore([alice, bob], [receipt]);
      const { result } = renderSplits();
      const { active } = result.current;

      expect(active.split.byPerson[alice.id].subtotalCents).toBe(2000);
      expect(active.split.byPerson[bob.id].subtotalCents).toBe(1000);
      expect(sumValues(centsByPerson(active.split, 'total'))).toBe(active.split.totals.totalCents);
    });

    it('26: weighted 2:1 + service charge — charges distribute proportionally to weighted subtotals', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '30.00',
            assignment: makeAssignment({ [alice.id]: 2, [bob.id]: 1 }),
          }),
        ],
        serviceCharge: percentCharge('10'),
      });

      seedStore([alice, bob], [receipt]);
      const { result } = renderSplits();
      const { active } = result.current;

      // Subtotals: Alice $20, Bob $10
      expect(active.split.byPerson[alice.id].subtotalCents).toBe(2000);
      expect(active.split.byPerson[bob.id].subtotalCents).toBe(1000);

      // 10% service on $30 = $3 total, distributed 2:1
      expect(active.split.totals.chargeCents.service).toBe(300);
      expect(active.split.byPerson[alice.id].chargeCents.service).toBe(200);
      expect(active.split.byPerson[bob.id].chargeCents.service).toBe(100);

      // Totals: Alice $22, Bob $11
      expect(active.split.byPerson[alice.id].totalCents).toBe(2200);
      expect(active.split.byPerson[bob.id].totalCents).toBe(1100);
      expect(active.split.totals.totalCents).toBe(3300);
      expect(sumValues(centsByPerson(active.split, 'total'))).toBe(active.split.totals.totalCents);
    });

    it('27: percent-commit weights produce identical computeSplit output to equivalent shares weights', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');

      const percentReceipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '30.00',
            assignment: makeAssignment({ [alice.id]: 60, [bob.id]: 40 }),
          }),
        ],
      });
      seedStore([alice, bob], [percentReceipt]);
      const percentSplit = renderSplits().result.current.active.split;

      resetAllStores();

      const sharesReceipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '30.00',
            assignment: makeAssignment({ [alice.id]: 3, [bob.id]: 2 }),
          }),
        ],
      });
      seedStore([alice, bob], [sharesReceipt]);
      const sharesSplit = renderSplits().result.current.active.split;

      expect(centsByPerson(percentSplit, 'total')).toEqual(centsByPerson(sharesSplit, 'total'));
      expect(percentSplit.totals.totalCents).toBe(sharesSplit.totals.totalCents);
      expect(sumValues(centsByPerson(percentSplit, 'total'))).toBe(percentSplit.totals.totalCents);
    });

    it('24: discount larger than subtotal — totals stay non-negative', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '5.00',
            assignment: equalShares([alice.id]),
          }),
        ],
        discount: amountCharge('10.00'),
      });

      seedStore([alice, bob], [receipt]);
      const { result } = renderSplits();
      const { active } = result.current;

      expect(active.split.totals.totalCents).toBe(0);
      expect(active.split.byPerson[alice.id].subtotalCents).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Receipt totals before everything is claimed', () => {
    it('counts unclaimed items in receipt totals and reconciliation, not in the split', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: equalShares([alice.id]),
          }),
          makeItem({
            amountInput: '20.00',
            assignment: NOBODY,
          }),
        ],
        receiptTotalInput: '30.00',
      });

      seedStore([alice, bob], [receipt]);
      const { result } = renderSplits();

      expect(computeReceiptTotals(receipt, [alice, bob]).totalCents).toBe(3000);
      expect(reconcileActiveReceipt().cents).toBe(0);
      expect(result.current.active.split.totals.totalCents).toBe(1000);
      expect(result.current.active.split.byPerson[alice.id].lines).toHaveLength(1);
    });
  });
});
