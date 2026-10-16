import { describe, expect, it } from 'vitest';
import { findReconciliationDiscount, resolveReconciliation } from './reconciliation';
import { NOBODY, equalShares } from '@features/split-workspace/logic/assignment';
import { resolveReceiptCharges } from '@features/split-workspace/logic/split/charges';
import {
  amountCharge,
  disabledCharge,
  makeItem,
  makeReceipt,
  percentCharge,
} from '../../../tests/integration/testHelpers';

describe('findReconciliationDiscount', () => {
  it.each([
    [percentCharge('10'), percentCharge('9'), 10791, 900, 891],
    [amountCharge('10.00'), percentCharge('9'), 10900, 1000, 900],
    [percentCharge('10'), amountCharge('9.00'), 10800, 900, 900],
  ])(
    'inverts rounded charges for target %s %s %i',
    (serviceCharge, gst, targetTotalCents, serviceChargeCents, gstCents) => {
      const input = {
        subtotalCents: 10000,
        currentDiscountCents: 0,
        serviceCharge,
        gst,
        targetTotalCents,
      };
      expect(findReconciliationDiscount(input)).toBe(1000);
      expect(
        resolveReceiptCharges({
          subtotalCents: 10000,
          discount: amountCharge('10.00'),
          serviceCharge,
          gst,
        }),
      ).toEqual({
        discountCents: 1000,
        discountedSubtotalCents: 9000,
        serviceChargeCents,
        gstCents,
        grandTotalCents: targetTotalCents,
      });
      expect(findReconciliationDiscount({ ...input, currentDiscountCents: 1000 })).toBeNull();
    },
  );

  it('discounts the whole subtotal for a receipt printed at zero', () => {
    expect(
      findReconciliationDiscount({
        subtotalCents: 2500,
        currentDiscountCents: 0,
        serviceCharge: percentCharge('10'),
        gst: percentCharge('9'),
        targetTotalCents: 0,
      }),
    ).toBe(2500);
  });

  it('keeps the existing discount when it ties for the closest total', () => {
    const input = {
      subtotalCents: 100,
      currentDiscountCents: 0,
      serviceCharge: percentCharge('100'),
      gst: disabledCharge,
      targetTotalCents: 199,
    };
    expect(findReconciliationDiscount(input)).toBeNull();
    expect(findReconciliationDiscount(input)).toBeNull();
  });

  it('selects the smaller discount when two changed discounts tie', () => {
    expect(
      findReconciliationDiscount({
        subtotalCents: 100,
        currentDiscountCents: 0,
        serviceCharge: percentCharge('100'),
        gst: disabledCharge,
        targetTotalCents: 197,
      }),
    ).toBe(1);
  });

  it('selects the nearer cent even when it crosses below the target', () => {
    expect(
      findReconciliationDiscount({
        subtotalCents: 100,
        currentDiscountCents: 0,
        serviceCharge: percentCharge('200'),
        gst: disabledCharge,
        targetTotalCents: 298,
      }),
    ).toBe(1);
  });

  it('stops at full discount when fixed charges prevent the target', () => {
    const input = {
      subtotalCents: 100,
      currentDiscountCents: 0,
      serviceCharge: amountCharge('0.50'),
      gst: disabledCharge,
      targetTotalCents: 10,
    };
    expect(findReconciliationDiscount(input)).toBe(100);
    expect(findReconciliationDiscount({ ...input, currentDiscountCents: 100 })).toBeNull();
    expect(
      resolveReceiptCharges({
        subtotalCents: 100,
        discount: amountCharge('1.00'),
        serviceCharge: input.serviceCharge,
        gst: disabledCharge,
      }).grandTotalCents,
    ).toBe(50);
  });

  it.each([
    [percentCharge('-10'), disabledCharge],
    [disabledCharge, percentCharge('-9')],
  ])('declines enabled negative percentage charges', (serviceCharge, gst) => {
    expect(
      findReconciliationDiscount({
        subtotalCents: 10000,
        currentDiscountCents: 0,
        serviceCharge,
        gst,
        targetTotalCents: 8000,
      }),
    ).toBeNull();
  });

  it('ignores a disabled negative percentage', () => {
    expect(
      findReconciliationDiscount({
        subtotalCents: 10000,
        currentDiscountCents: 0,
        serviceCharge: { ...percentCharge('-10'), enabled: false },
        gst: disabledCharge,
        targetTotalCents: 9000,
      }),
    ).toBe(1000);
  });

  it.each([-1, NaN, Infinity, 1.5, 10001])(
    'declines invalid or higher target %s',
    (targetTotalCents) => {
      expect(
        findReconciliationDiscount({
          subtotalCents: 10000,
          currentDiscountCents: 0,
          serviceCharge: disabledCharge,
          gst: disabledCharge,
          targetTotalCents,
        }),
      ).toBeNull();
    },
  );
});

describe('resolveReconciliation', () => {
  const alice = { id: 'a', name: 'Alice' };
  const bob = { id: 'b', name: 'Bob' };
  const meal = (amountInput: string, assignment = equalShares([alice.id])) =>
    makeItem({ amountInput, assignment });

  it('has nothing to reconcile until a receipt total is entered', () => {
    const receipt = makeReceipt({ items: [meal('10.00')], receiptTotalInput: '' });

    expect(resolveReconciliation(receipt, [alice])).toEqual({ cents: null, fix: null });
  });

  it('needs no fix when the receipt total matches', () => {
    const receipt = makeReceipt({ items: [meal('10.00')], receiptTotalInput: '10.00' });

    expect(resolveReconciliation(receipt, [alice])).toEqual({ cents: 0, fix: null });
  });

  it('offers the missing amount as rounding when the receipt total is higher', () => {
    const receipt = makeReceipt({ items: [meal('10.00')], receiptTotalInput: '12.00' });

    expect(resolveReconciliation(receipt, [alice])).toEqual({
      cents: 200,
      fix: { roundingInput: '2.00' },
    });
  });

  it('checks the printed total against the bill before the tip', () => {
    const receipt = makeReceipt({
      items: [meal('10.00')],
      tip: percentCharge('20'),
      receiptTotalInput: '10.00',
    });

    expect(resolveReconciliation(receipt, [alice])).toEqual({ cents: 0, fix: null });
  });

  it('sizes rounding from the bill before the tip', () => {
    const receipt = makeReceipt({
      items: [meal('10.00')],
      tip: percentCharge('20'),
      receiptTotalInput: '10.50',
    });

    expect(resolveReconciliation(receipt, [alice])).toEqual({
      cents: 50,
      fix: { roundingInput: '0.50' },
    });
  });

  it('adds the gap to any rounding already on the receipt', () => {
    const receipt = makeReceipt({
      items: [meal('10.00')],
      receiptTotalInput: '10.40',
      roundingInput: '0.10',
    });

    expect(resolveReconciliation(receipt, [alice])).toEqual({
      cents: 30,
      fix: { roundingInput: '0.40' },
    });
  });

  it('offers a discount as an amount when the receipt total is lower', () => {
    const receipt = makeReceipt({ items: [meal('10.00')], receiptTotalInput: '9.00' });

    expect(resolveReconciliation(receipt, [alice])).toEqual({
      cents: -100,
      fix: { discount: { ...disabledCharge, enabled: true, mode: 'amount', amountInput: '1.00' } },
    });
  });

  it('sizes the discount before tax, so both percentage charges are recomputed', () => {
    const receipt = makeReceipt({
      items: [meal('100.00')],
      discount: percentCharge('5'),
      serviceCharge: percentCharge('10'),
      gst: percentCharge('9'),
      receiptTotalInput: '107.91',
    });

    const { fix } = resolveReconciliation(receipt, [alice]);

    expect(fix).toEqual({
      discount: { ...percentCharge('5'), mode: 'amount', amountInput: '10.00' },
    });
    expect(resolveReconciliation({ ...receipt, ...fix }, [alice])).toEqual({ cents: 0, fix: null });
  });

  it('leaves rounding out of the discount search', () => {
    const receipt = makeReceipt({
      items: [meal('9.90')],
      receiptTotalInput: '9.10',
      roundingInput: '0.10',
    });

    expect(resolveReconciliation(receipt, [alice]).fix).toEqual({
      discount: expect.objectContaining({ amountInput: '0.90' }),
    });
  });

  it('has no fix left once a full discount still cannot reach the receipt total', () => {
    const receipt = makeReceipt({
      items: [meal('1.00')],
      serviceCharge: amountCharge('0.50'),
      receiptTotalInput: '0.10',
    });
    const first = resolveReconciliation(receipt, [alice]);
    expect(first.fix).toEqual({ discount: expect.objectContaining({ amountInput: '1.00' }) });

    expect(resolveReconciliation({ ...receipt, ...first.fix }, [alice])).toEqual({
      cents: -40,
      fix: null,
    });
  });

  it('counts items nobody has taken yet, so the gap does not move as people pick items', () => {
    const receipt = makeReceipt({
      items: [meal('10.00'), meal('20.00', NOBODY)],
      receiptTotalInput: '30.00',
    });

    expect(resolveReconciliation(receipt, [alice, bob])).toEqual({ cents: 0, fix: null });
  });
});
