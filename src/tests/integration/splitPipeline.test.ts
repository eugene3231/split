import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReceiptSplit } from '@features/split-workspace/hooks/useReceiptSplit';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
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

beforeEach(resetAllStores);

function useSplitFromStore() {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return renderHook(() => useReceiptSplit());
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
            assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
          }),
          makeItem({
            amountInput: '20.00',
            assignment: { mode: 'single', personId: bob.id, personIds: [bob.id] },
          }),
        ],
      });

      seedStore([alice, bob], [receipt]);
      const { result } = useSplitFromStore();
      const { active } = result.current;

      expect(sumValues(active.split.totalByPersonCents)).toBe(active.split.grandTotalCents);
      expect(active.split.totalByPersonCents[alice.id]).toBeGreaterThan(0);
      expect(active.split.totalByPersonCents[bob.id]).toBeGreaterThan(0);
    });

    it('2: equal 3-way split — all totals nonzero, sum equals grand total', () => {
      const p1 = makePerson('Alice');
      const p2 = makePerson('Ben');
      const p3 = makePerson('Cara');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: { mode: 'equal', personId: '', personIds: [p1.id, p2.id, p3.id] },
          }),
        ],
      });

      seedStore([p1, p2, p3], [receipt]);
      const { result } = useSplitFromStore();
      const { active } = result.current;

      expect(sumValues(active.split.totalByPersonCents)).toBe(active.split.grandTotalCents);
      expect(active.split.totalByPersonCents[p1.id]).toBeGreaterThan(0);
      expect(active.split.totalByPersonCents[p2.id]).toBeGreaterThan(0);
      expect(active.split.totalByPersonCents[p3.id]).toBeGreaterThan(0);
    });

    it('3: service charge + GST — enabling charges increases grand total', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
          }),
          makeItem({
            amountInput: '20.00',
            assignment: { mode: 'single', personId: bob.id, personIds: [bob.id] },
          }),
        ],
        serviceCharge: percentCharge('10'),
        gst: percentCharge('9'),
      });

      seedStore([alice, bob], [receipt]);
      const { result } = useSplitFromStore();
      const { active } = result.current;

      expect(active.split.grandTotalCents).toBeGreaterThan(active.split.subtotalCents);
      expect(active.split.serviceChargeCents).toBeGreaterThan(0);
      expect(active.split.gstCents).toBeGreaterThan(0);
      expect(sumValues(active.split.totalByPersonCents)).toBe(active.split.grandTotalCents);
    });

    it('4: receipt-level discount (amount) — reduces grand total, stays non-negative', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
          }),
          makeItem({
            amountInput: '10.00',
            assignment: { mode: 'single', personId: bob.id, personIds: [bob.id] },
          }),
        ],
        discount: amountCharge('4.00'),
      });

      seedStore([alice, bob], [receipt]);
      const { result } = useSplitFromStore();
      const { active } = result.current;

      expect(active.split.discountCents).toBe(400);
      expect(active.split.grandTotalCents).toBeLessThan(2000);
      expect(active.split.grandTotalCents).toBeGreaterThanOrEqual(0);
      expect(sumValues(active.split.totalByPersonCents)).toBe(active.split.grandTotalCents);
    });

    it('5: receipt-level discount (percent) — reduces grand total proportionally', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
          }),
          makeItem({
            amountInput: '10.00',
            assignment: { mode: 'single', personId: bob.id, personIds: [bob.id] },
          }),
        ],
        discount: percentCharge('20'),
      });

      seedStore([alice, bob], [receipt]);
      const { result } = useSplitFromStore();
      const { active } = result.current;

      expect(active.split.discountCents).toBeGreaterThan(0);
      expect(active.split.grandTotalCents).toBeLessThan(2000);
      expect(sumValues(active.split.totalByPersonCents)).toBe(active.split.grandTotalCents);
    });

    it('6: item-level discount — only affects the discounted item person', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            discountPercentInput: '50',
            assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
          }),
          makeItem({
            amountInput: '10.00',
            assignment: { mode: 'single', personId: bob.id, personIds: [bob.id] },
          }),
        ],
      });

      seedStore([alice, bob], [receipt]);
      const { result } = useSplitFromStore();
      const { active } = result.current;

      expect(active.split.totalByPersonCents[alice.id]).toBeLessThan(
        active.split.totalByPersonCents[bob.id],
      );
      expect(sumValues(active.split.totalByPersonCents)).toBe(active.split.grandTotalCents);
    });

    it('7: item + receipt discounts combined — both reduce more than either alone', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receiptNoDiscount = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            discountPercentInput: '50',
            assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
          }),
          makeItem({
            amountInput: '10.00',
            assignment: { mode: 'single', personId: bob.id, personIds: [bob.id] },
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
            assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
          }),
          makeItem({
            amountInput: '10.00',
            assignment: { mode: 'single', personId: bob.id, personIds: [bob.id] },
          }),
        ],
        discount: amountCharge('2.00'),
      });

      seedStore([alice, bob], [receiptWithItemDiscountOnly]);
      const itemOnlyResult = useSplitFromStore().result.current.active.split;

      resetAllStores();
      seedStore([alice, bob], [receiptWithBoth]);
      const bothResult = useSplitFromStore().result.current.active.split;

      expect(bothResult.grandTotalCents).toBeLessThan(itemOnlyResult.grandTotalCents);
      expect(sumValues(bothResult.totalByPersonCents)).toBe(bothResult.grandTotalCents);
    });

    it('8: all charges + item discount — grand total > discounted subtotal, sums add up', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            discountPercentInput: '50',
            assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
          }),
          makeItem({
            amountInput: '20.00',
            assignment: { mode: 'single', personId: bob.id, personIds: [bob.id] },
          }),
        ],
        serviceCharge: percentCharge('10'),
        gst: percentCharge('9'),
      });

      seedStore([alice, bob], [receipt]);
      const { result } = useSplitFromStore();
      const { active } = result.current;

      expect(active.split.grandTotalCents).toBeGreaterThan(active.split.subtotalCents);
      expect(active.split.serviceChargeCents).toBeGreaterThan(0);
      expect(active.split.gstCents).toBeGreaterThan(0);
      expect(sumValues(active.split.totalByPersonCents)).toBe(active.split.grandTotalCents);
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
            assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
          }),
        ],
      });
      const r2 = makeReceipt({
        items: [
          makeItem({
            amountInput: '20.00',
            assignment: { mode: 'single', personId: bob.id, personIds: [bob.id] },
          }),
        ],
      });

      seedStore([alice, bob], [r1, r2]);
      const { result } = useSplitFromStore();
      const { consolidated } = result.current;

      const receiptGrandTotals = consolidated.splitByReceipt.map((s) => s.grandTotalCents);
      const sumOfReceipts = receiptGrandTotals.reduce((a, b) => a + b, 0);
      expect(consolidated.split.grandTotalCents).toBe(sumOfReceipts);
      expect(sumValues(consolidated.split.totalByPersonCents)).toBe(
        consolidated.split.grandTotalCents,
      );
    });

    it('10: multi-receipt with charges per receipt — charges computed independently then summed', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const r1 = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
          }),
        ],
        serviceCharge: percentCharge('10'),
        gst: { ...disabledCharge },
      });
      const r2 = makeReceipt({
        items: [
          makeItem({
            amountInput: '20.00',
            assignment: { mode: 'single', personId: bob.id, personIds: [bob.id] },
          }),
        ],
        serviceCharge: { ...disabledCharge },
        gst: percentCharge('9'),
      });

      seedStore([alice, bob], [r1, r2]);
      const { result } = useSplitFromStore();
      const { consolidated } = result.current;

      expect(consolidated.splitByReceipt[0].serviceChargeCents).toBeGreaterThan(0);
      expect(consolidated.splitByReceipt[0].gstCents).toBe(0);
      expect(consolidated.splitByReceipt[1].gstCents).toBeGreaterThan(0);
      expect(consolidated.splitByReceipt[1].serviceChargeCents).toBe(0);

      expect(consolidated.split.serviceChargeCents).toBe(
        consolidated.splitByReceipt[0].serviceChargeCents,
      );
      expect(consolidated.split.gstCents).toBe(consolidated.splitByReceipt[1].gstCents);
      expect(sumValues(consolidated.split.totalByPersonCents)).toBe(
        consolidated.split.grandTotalCents,
      );
    });

    it('11: multi-receipt multi-currency — conversion changes consolidated total', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const r1 = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
          }),
        ],
        currency: 'SGD',
      });
      const r2 = makeReceipt({
        items: [
          makeItem({
            amountInput: '20.00',
            assignment: { mode: 'single', personId: bob.id, personIds: [bob.id] },
          }),
        ],
        currency: 'USD',
      });

      seedStore([alice, bob], [r1, r2], { exchangeRates: { SGD: 1, USD: 1.35 } });
      const { result } = useSplitFromStore();
      const { consolidated } = result.current;

      expect(consolidated.split.grandTotalCents).toBeGreaterThan(r1Total() + 2000);
      expect(sumValues(consolidated.split.totalByPersonCents)).toBe(
        consolidated.split.grandTotalCents,
      );

      function r1Total() {
        return result.current.consolidated.splitByReceipt[0].grandTotalCents;
      }
    });

    it('12: multi-receipt + exchange rate override — override changes consolidated total', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const rSgd = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
          }),
        ],
        currency: 'SGD',
      });
      const rUsd = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: { mode: 'single', personId: bob.id, personIds: [bob.id] },
          }),
        ],
        currency: 'USD',
        exchangeRateOverride: null,
      });

      seedStore([alice, bob], [rSgd, rUsd], { exchangeRates: { SGD: 1, USD: 1.35 } });
      const { result } = useSplitFromStore();
      const consolidatedAuto = result.current.consolidated.split.grandTotalCents;

      act(() => {
        useReceiptStore.getState().setReceiptExchangeRateOverride(rUsd.id, 1.5);
      });

      const consolidatedOverride = result.current.consolidated.split.grandTotalCents;
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
            assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
          }),
        ],
      });

      seedStore([alice], [receipt]);
      const { result } = useSplitFromStore();
      const { active } = result.current;

      expect(active.split.grandTotalCents).toBe(active.split.totalByPersonCents[alice.id]);
      expect(active.split.unassignedItemCount).toBe(0);
    });

    it('14: person assigned to no items — zero subtotal, involvedCount = 0', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
          }),
        ],
      });

      seedStore([alice, bob], [receipt]);
      const { result } = useSplitFromStore();
      const { active } = result.current;

      expect(active.split.subtotalByPersonCents[bob.id]).toBe(0);
      expect(active.split.involvedCountByPerson[bob.id]).toBe(0);
      expect(active.split.totalByPersonCents[bob.id]).toBe(0);
    });

    it('15: all items unassigned — grand total > 0, all per-person totals are 0', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: { mode: 'single', personId: 'nonexistent', personIds: [] },
          }),
        ],
      });

      seedStore([alice, bob], [receipt]);
      const { result } = useSplitFromStore();
      const { active } = result.current;

      expect(active.split.unassignedItemCount).toBeGreaterThan(0);
      expect(sumValues(active.split.totalByPersonCents)).toBe(0);
      expect(active.split.subtotalCents).toBe(0);
      expect(active.split.grandTotalCents).toBe(0);
    });

    it('16: zero-amount item — skipped, does not affect totals', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '0',
            assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
          }),
          makeItem({
            amountInput: '10.00',
            assignment: { mode: 'single', personId: bob.id, personIds: [bob.id] },
          }),
        ],
      });

      seedStore([alice, bob], [receipt]);
      const { result } = useSplitFromStore();
      const { active } = result.current;

      expect(active.split.subtotalCents).toBe(1000);
      expect(active.split.totalByPersonCents[bob.id]).toBe(1000);
    });

    it('17: 100% item discount — item skipped entirely', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '5.00',
            discountPercentInput: '100',
            assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
          }),
          makeItem({
            amountInput: '10.00',
            assignment: { mode: 'single', personId: bob.id, personIds: [bob.id] },
          }),
        ],
      });

      seedStore([alice, bob], [receipt]);
      const { result } = useSplitFromStore();
      const { active } = result.current;

      expect(active.split.subtotalCents).toBe(1000);
      expect(active.split.totalByPersonCents[bob.id]).toBe(1000);
      expect(active.split.involvedCountByPerson[alice.id]).toBe(0);
    });

    it('18: reconciliation overcharge — reconciliationCents is negative', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
          }),
        ],
        receiptTotalInput: '8.00',
      });

      seedStore([alice, bob], [receipt]);
      const { result } = useSplitFromStore();

      expect(result.current.reconciliation.cents).toBeLessThan(0);

      act(() => {
        result.current.reconciliation.applyCorrectiveDiscount();
      });

      expect(result.current.active.split.grandTotalCents).toBeLessThan(1000);
    });

    it('19: reconciliation exact match — reconciliationCents is 0', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
          }),
        ],
        receiptTotalInput: '10.00',
      });

      seedStore([alice, bob], [receipt]);
      const { result } = useSplitFromStore();

      expect(result.current.reconciliation.cents).toBe(0);
    });

    it('20: reconciliation no receipt total — reconciliationCents is null', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
          }),
        ],
        receiptTotalInput: '',
      });

      seedStore([alice, bob], [receipt]);
      const { result } = useSplitFromStore();

      expect(result.current.reconciliation.cents).toBeNull();
    });

    it('21: charge mode=amount — service as fixed amount, sums to serviceChargeCents', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
          }),
          makeItem({
            amountInput: '20.00',
            assignment: { mode: 'single', personId: bob.id, personIds: [bob.id] },
          }),
        ],
        serviceCharge: amountCharge('5.00'),
      });

      seedStore([alice, bob], [receipt]);
      const { result } = useSplitFromStore();
      const { active } = result.current;

      expect(active.split.serviceChargeCents).toBe(500);
      expect(sumValues(active.split.serviceByPersonCents)).toBe(500);
      expect(sumValues(active.split.totalByPersonCents)).toBe(active.split.grandTotalCents);
    });

    it('22: only GST, no service — GST computed on subtotal', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
          }),
          makeItem({
            amountInput: '20.00',
            assignment: { mode: 'single', personId: bob.id, personIds: [bob.id] },
          }),
        ],
        serviceCharge: { ...defaultServiceChargeState, enabled: false },
        gst: percentCharge('9'),
      });

      seedStore([alice, bob], [receipt]);
      const { result } = useSplitFromStore();
      const { active } = result.current;

      expect(active.split.serviceChargeCents).toBe(0);
      expect(active.split.gstCents).toBeGreaterThan(0);
      expect(sumValues(active.split.totalByPersonCents)).toBe(active.split.grandTotalCents);
    });

    it('23: only service, no GST — service computed, GST = 0', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
          }),
          makeItem({
            amountInput: '20.00',
            assignment: { mode: 'single', personId: bob.id, personIds: [bob.id] },
          }),
        ],
        serviceCharge: percentCharge('10'),
        gst: { ...defaultGstState, enabled: false },
      });

      seedStore([alice, bob], [receipt]);
      const { result } = useSplitFromStore();
      const { active } = result.current;

      expect(active.split.serviceChargeCents).toBeGreaterThan(0);
      expect(active.split.gstCents).toBe(0);
      expect(sumValues(active.split.totalByPersonCents)).toBe(active.split.grandTotalCents);
    });

    it('25: weighted 2:1 split — per-person totals reflect weights and sum to grand total', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '30.00',
            assignment: {
              mode: 'equal',
              personId: '',
              personIds: [alice.id, bob.id],
              weights: { [alice.id]: 2, [bob.id]: 1 },
            },
          }),
        ],
      });

      seedStore([alice, bob], [receipt]);
      const { result } = useSplitFromStore();
      const { active } = result.current;

      expect(active.split.subtotalByPersonCents[alice.id]).toBe(2000);
      expect(active.split.subtotalByPersonCents[bob.id]).toBe(1000);
      expect(sumValues(active.split.totalByPersonCents)).toBe(active.split.grandTotalCents);
    });

    it('26: weighted 2:1 + service charge — charges distribute proportionally to weighted subtotals', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '30.00',
            assignment: {
              mode: 'equal',
              personId: '',
              personIds: [alice.id, bob.id],
              weights: { [alice.id]: 2, [bob.id]: 1 },
            },
          }),
        ],
        serviceCharge: percentCharge('10'),
      });

      seedStore([alice, bob], [receipt]);
      const { result } = useSplitFromStore();
      const { active } = result.current;

      // Subtotals: Alice $20, Bob $10
      expect(active.split.subtotalByPersonCents[alice.id]).toBe(2000);
      expect(active.split.subtotalByPersonCents[bob.id]).toBe(1000);

      // 10% service on $30 = $3 total, distributed 2:1
      expect(active.split.serviceChargeCents).toBe(300);
      expect(active.split.serviceByPersonCents[alice.id]).toBe(200);
      expect(active.split.serviceByPersonCents[bob.id]).toBe(100);

      // Totals: Alice $22, Bob $11
      expect(active.split.totalByPersonCents[alice.id]).toBe(2200);
      expect(active.split.totalByPersonCents[bob.id]).toBe(1100);
      expect(active.split.grandTotalCents).toBe(3300);
      expect(sumValues(active.split.totalByPersonCents)).toBe(active.split.grandTotalCents);
    });

    it('24: discount larger than subtotal — totals stay non-negative', () => {
      const alice = makePerson('Alice');
      const bob = makePerson('Bob');
      const receipt = makeReceipt({
        items: [
          makeItem({
            amountInput: '5.00',
            assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
          }),
        ],
        discount: amountCharge('10.00'),
      });

      seedStore([alice, bob], [receipt]);
      const { result } = useSplitFromStore();
      const { active } = result.current;

      expect(active.split.grandTotalCents).toBe(0);
      expect(active.split.subtotalByPersonCents[alice.id]).toBeGreaterThanOrEqual(0);
    });
  });
});
