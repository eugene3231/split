import { describe, expect, it } from 'vitest';
import { findReconciliationDiscount } from './reconciliation';
import { resolveReceiptCharges } from '@features/split-workspace/logic/split/charges';
import {
  amountCharge,
  disabledCharge,
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
