import { describe, expect, it } from 'vitest';
import type { PersonReceiptLineItem, Receipt, SplitResult } from '@shared/types';
import {
  convertCents,
  convertSplitResult,
  getEffectiveRate,
  getForeignReceiptRates,
} from '@shared/logic/core/exchangeRates';

const rates: Record<string, number> = {
  SGD: 1,
  USD: 1.35,
  THB: 0.038,
  JPY: 0.009,
};

// Minimal SplitResult for two people
function makeSplitResult(overrides: Partial<SplitResult> = {}): SplitResult {
  return {
    lineItemsByPerson: {
      p1: [
        {
          itemId: 'i1',
          name: 'Pad Thai',
          grossAmountCents: 500,
          discountPercent: 0,
          discountAmountCents: 0,
          netAmountCents: 500,
          assignedAmountCents: 250,
          splitCount: 2,
          involved: true,
        },
      ],
      p2: [
        {
          itemId: 'i1',
          name: 'Pad Thai',
          grossAmountCents: 500,
          discountPercent: 0,
          discountAmountCents: 0,
          netAmountCents: 500,
          assignedAmountCents: 250,
          splitCount: 2,
          involved: true,
        },
      ],
    },
    involvedCountByPerson: { p1: 1, p2: 1 },
    subtotalByPersonCents: { p1: 250, p2: 250 },
    discountByPersonCents: { p1: 0, p2: 0 },
    serviceByPersonCents: { p1: 13, p2: 12 },
    gstByPersonCents: { p1: 11, p2: 11 },
    totalByPersonCents: { p1: 274, p2: 273 },
    subtotalCents: 500,
    discountCents: 0,
    serviceChargeCents: 25,
    gstCents: 22,
    grandTotalCents: 547,
    unassignedItemCount: 0,
    ...overrides,
  };
}

function line(
  itemId: string,
  assignedAmountCents: number,
  grossAmountCents = assignedAmountCents,
): PersonReceiptLineItem {
  return {
    itemId,
    name: itemId,
    grossAmountCents,
    discountPercent: 0,
    discountAmountCents: grossAmountCents - assignedAmountCents,
    netAmountCents: assignedAmountCents,
    assignedAmountCents,
    splitCount: 1,
    involved: true,
  };
}

function sum(values: Record<string, number>): number {
  return Object.values(values).reduce((total, value) => total + value, 0);
}

// ─── getEffectiveRate ─────────────────────────────────────────────────────────

describe('getEffectiveRate', () => {
  it('uses override when provided', () => {
    expect(getEffectiveRate('USD', rates, 1.5)).toBe(1.5);
  });

  it('uses rates map when no override', () => {
    expect(getEffectiveRate('USD', rates, null)).toBe(1.35);
  });

  it('falls back to FALLBACK_RATES_TO_SGD when currency not in rates', () => {
    // EUR not in our test rates but is in FALLBACK_RATES_TO_SGD
    const rate = getEffectiveRate('EUR', {}, null);
    expect(rate).toBeGreaterThan(0);
  });

  it('ignores override of 0 (treats as null)', () => {
    // override of 0 is invalid, should fall through to rates map
    expect(getEffectiveRate('USD', rates, 0)).toBe(1.35);
  });

  it('returns 1 for completely unknown currency not in rates or fallbacks', () => {
    expect(getEffectiveRate('ZZZ', {}, null)).toBe(1);
  });
});

// ─── convertCents ─────────────────────────────────────────────────────────────

describe('convertCents', () => {
  it('returns the same value when currencies are identical', () => {
    expect(convertCents(1000, 'SGD', 'SGD', rates)).toBe(1000);
    expect(convertCents(500, 'USD', 'USD', rates)).toBe(500);
  });

  it('converts USD to SGD correctly', () => {
    // 100 USD cents → 100 * 1.35 / 1 = 135 SGD cents
    expect(convertCents(100, 'USD', 'SGD', rates)).toBe(135);
  });

  it('converts SGD to USD correctly', () => {
    // 135 SGD cents → 135 * 1 / 1.35 = 100 USD cents
    expect(convertCents(135, 'SGD', 'USD', rates)).toBe(100);
  });

  it('converts THB to SGD with rounding', () => {
    // 1000 THB cents → 1000 * 0.038 / 1 = 38 SGD cents
    expect(convertCents(1000, 'THB', 'SGD', rates)).toBe(38);
  });

  it('applies user override rate instead of rates map', () => {
    // 100 USD cents at override rate 1.5 → 150 SGD cents
    expect(convertCents(100, 'USD', 'SGD', rates, 1.5)).toBe(150);
  });

  it('rounds to nearest cent', () => {
    // 1 THB cent * 0.038 = 0.038 SGD cents → rounds to 0
    expect(convertCents(1, 'THB', 'SGD', rates)).toBe(0);
    // 10 THB cents * 0.038 = 0.38 SGD cents → rounds to 0
    expect(convertCents(10, 'THB', 'SGD', rates)).toBe(0);
    // 14 THB cents * 0.038 = 0.532 → rounds to 1
    expect(convertCents(14, 'THB', 'SGD', rates)).toBe(1);
  });
});

// ─── convertSplitResult ───────────────────────────────────────────────────────

describe('convertSplitResult', () => {
  it('returns the same result unchanged when currencies are identical', () => {
    const split = makeSplitResult();
    const result = convertSplitResult(split, 'SGD', 'SGD', rates);
    expect(result).toBe(split); // same reference
  });

  it('converts all monetary fields from USD to SGD', () => {
    const split = makeSplitResult({
      subtotalCents: 1000, // $10 USD → $13.50 SGD = 1350 SGD cents
      grandTotalCents: 1200, // $12 USD → $16.20 SGD = 1620 SGD cents
      serviceChargeCents: 100, // $1 USD → $1.35 SGD = 135 SGD cents
      gstCents: 100,
      discountCents: 0,
      subtotalByPersonCents: { p1: 500, p2: 500 },
      totalByPersonCents: { p1: 600, p2: 600 },
      serviceByPersonCents: { p1: 50, p2: 50 },
      gstByPersonCents: { p1: 50, p2: 50 },
      discountByPersonCents: { p1: 0, p2: 0 },
    });

    const result = convertSplitResult(split, 'USD', 'SGD', rates);

    // 1 USD = 1.35 SGD
    expect(result.subtotalCents).toBe(1350);
    expect(result.grandTotalCents).toBe(1620);
    expect(result.serviceChargeCents).toBe(135);
    expect(result.gstCents).toBe(135);
    expect(result.subtotalByPersonCents).toEqual({ p1: 675, p2: 675 });
    expect(result.totalByPersonCents).toEqual({ p1: 810, p2: 810 });
  });

  it('balances tied charge cents between people with equal native totals', () => {
    const split = makeSplitResult({
      lineItemsByPerson: { p1: [line('a', 500)], p2: [line('b', 500)] },
      subtotalByPersonCents: { p1: 500, p2: 500 },
      discountByPersonCents: { p1: 0, p2: 0 },
      serviceByPersonCents: { p1: 50, p2: 50 },
      gstByPersonCents: { p1: 50, p2: 50 },
      totalByPersonCents: { p1: 600, p2: 600 },
      subtotalCents: 1000,
      discountCents: 0,
      serviceChargeCents: 100,
      gstCents: 100,
      grandTotalCents: 1200,
    });

    const converted = convertSplitResult(split, 'USD', 'SGD', rates);

    expect(converted.serviceByPersonCents).toEqual({ p1: 68, p2: 67 });
    expect(converted.gstByPersonCents).toEqual({ p1: 67, p2: 68 });
    expect(converted.totalByPersonCents).toEqual({ p1: 810, p2: 810 });
    expect(converted.grandTotalCents).toBe(1620);
  });

  it('converts line item amounts', () => {
    const split = makeSplitResult(); // line items have assignedAmountCents: 250
    const result = convertSplitResult(split, 'USD', 'SGD', rates);

    // 250 USD cents * 1.35 = 337.5 → 338 SGD cents
    expect(result.lineItemsByPerson.p1[0].assignedAmountCents).toBe(338);
    expect(result.lineItemsByPerson.p2[0].assignedAmountCents).toBe(337);
    expect(result.lineItemsByPerson.p1[0].grossAmountCents).toBe(675); // 500 * 1.35
  });

  it('converts the receipt once and allocates its rounding cent across people', () => {
    const split = makeSplitResult({
      lineItemsByPerson: { p1: [line('a', 1001)], p2: [line('b', 1001)] },
      subtotalByPersonCents: { p1: 1001, p2: 1001 },
      discountByPersonCents: { p1: 0, p2: 0 },
      serviceByPersonCents: { p1: 0, p2: 0 },
      gstByPersonCents: { p1: 0, p2: 0 },
      totalByPersonCents: { p1: 1001, p2: 1001 },
      subtotalCents: 2002,
      discountCents: 0,
      serviceChargeCents: 0,
      gstCents: 0,
      grandTotalCents: 2002,
    });

    const converted = convertSplitResult(split, 'USD', 'SGD', rates);

    expect(converted.grandTotalCents).toBe(2703);
    expect(converted.totalByPersonCents).toEqual({ p1: 1352, p2: 1351 });
    expect(converted.lineItemsByPerson.p1[0].assignedAmountCents).toBe(1352);
    expect(converted.lineItemsByPerson.p2[0].assignedAmountCents).toBe(1351);
  });

  it('balances categories and item lines through discounts, service, and GST', () => {
    const split = makeSplitResult({
      lineItemsByPerson: {
        p1: [line('discounted', 1001, 1011), line('small', 1)],
        p2: [line('other', 1001)],
      },
      subtotalByPersonCents: { p1: 1002, p2: 1001 },
      discountByPersonCents: { p1: 1, p2: 1 },
      serviceByPersonCents: { p1: 1, p2: 1 },
      gstByPersonCents: { p1: 1, p2: 0 },
      totalByPersonCents: { p1: 1003, p2: 1001 },
      subtotalCents: 2003,
      discountCents: 2,
      serviceChargeCents: 2,
      gstCents: 1,
      grandTotalCents: 2004,
    });

    const converted = convertSplitResult(split, 'USD', 'SGD', rates);

    expect(converted.grandTotalCents).toBe(2705);
    expect(converted.subtotalCents).toBe(2704);
    expect(converted.discountCents).toBe(3);
    expect(converted.serviceChargeCents).toBe(3);
    expect(converted.gstCents).toBe(1);
    expect(converted.lineItemsByPerson.p1.map((item) => item.assignedAmountCents)).toEqual([
      1352, 1,
    ]);
    expect(sum(converted.subtotalByPersonCents)).toBe(converted.subtotalCents);
    expect(sum(converted.discountByPersonCents)).toBe(converted.discountCents);
    expect(sum(converted.serviceByPersonCents)).toBe(converted.serviceChargeCents);
    expect(sum(converted.gstByPersonCents)).toBe(converted.gstCents);
    expect(sum(converted.totalByPersonCents)).toBe(converted.grandTotalCents);
    expect(
      converted.subtotalCents -
        converted.discountCents +
        converted.serviceChargeCents +
        converted.gstCents,
    ).toBe(converted.grandTotalCents);
    for (const personId of ['p1', 'p2']) {
      expect(
        converted.lineItemsByPerson[personId].reduce(
          (total, item) => total + item.assignedAmountCents,
          0,
        ),
      ).toBe(converted.subtotalByPersonCents[personId]);
      expect(converted.totalByPersonCents[personId]).toBe(
        converted.subtotalByPersonCents[personId] -
          converted.discountByPersonCents[personId] +
          converted.serviceByPersonCents[personId] +
          converted.gstByPersonCents[personId],
      );
    }
    const discountedLine = converted.lineItemsByPerson.p1[0];
    expect(discountedLine.grossAmountCents - discountedLine.discountAmountCents).toBe(
      discountedLine.assignedAmountCents,
    );
  });

  it('preserves involvedCountByPerson unchanged (not a monetary field)', () => {
    const split = makeSplitResult();
    const result = convertSplitResult(split, 'USD', 'SGD', rates);
    expect(result.involvedCountByPerson).toEqual({ p1: 1, p2: 1 });
  });

  it('preserves unassignedItemCount unchanged', () => {
    const split = makeSplitResult({ unassignedItemCount: 3 });
    const result = convertSplitResult(split, 'USD', 'SGD', rates);
    expect(result.unassignedItemCount).toBe(3);
  });

  it('applies user override rate to the conversion', () => {
    const split = makeSplitResult({ subtotalCents: 1000, grandTotalCents: 1000 });
    const result = convertSplitResult(split, 'USD', 'SGD', rates, 1.5);
    // 1000 cents * 1.5 = 1500 SGD cents
    expect(result.subtotalCents).toBe(1500);
    expect(result.grandTotalCents).toBe(1500);
  });
});

// ─── getForeignReceiptRates ───────────────────────────────────────────────────

function makeReceipt(currency: string, exchangeRateOverride: number | null = null): Receipt {
  return {
    id: 'r1',
    name: 'Receipt',
    items: [],
    discount: {
      enabled: false,
      mode: 'percent',
      amountInput: '',
      percentInput: '',
      detectedConfidence: null,
      detectedSource: null,
    },
    serviceCharge: {
      enabled: false,
      mode: 'percent',
      amountInput: '',
      percentInput: '',
      detectedConfidence: null,
      detectedSource: null,
    },
    gst: {
      enabled: false,
      mode: 'percent',
      amountInput: '',
      percentInput: '',
      detectedConfidence: null,
      detectedSource: null,
    },
    receiptTotalInput: '',
    currency,
    exchangeRateOverride,
  };
}

describe('getForeignReceiptRates', () => {
  it('returns empty array when all receipts are SGD', () => {
    const receipts = [makeReceipt('SGD'), makeReceipt('SGD')];
    expect(getForeignReceiptRates(receipts, rates)).toEqual([]);
  });

  it('returns one entry per distinct foreign currency', () => {
    const receipts = [makeReceipt('USD'), makeReceipt('JPY')];
    const result = getForeignReceiptRates(receipts, rates);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.currency)).toEqual(['USD', 'JPY']);
  });

  it('deduplicates receipts sharing the same currency', () => {
    const receipts = [makeReceipt('USD'), makeReceipt('USD')];
    const result = getForeignReceiptRates(receipts, rates);
    expect(result).toHaveLength(1);
    expect(result[0].currency).toBe('USD');
  });

  it('uses override rate when present', () => {
    const receipts = [makeReceipt('USD', 1.5)];
    const result = getForeignReceiptRates(receipts, rates);
    expect(result[0].rate).toBe(1.5);
    expect(result[0].hasCustomRate).toBe(true);
  });

  it('uses rates map rate when no override', () => {
    const receipts = [makeReceipt('USD')];
    const result = getForeignReceiptRates(receipts, rates);
    expect(result[0].rate).toBe(1.35);
    expect(result[0].hasCustomRate).toBe(false);
  });

  it('excludes SGD receipts mixed with foreign receipts', () => {
    const receipts = [makeReceipt('SGD'), makeReceipt('USD'), makeReceipt('SGD')];
    const result = getForeignReceiptRates(receipts, rates);
    expect(result).toHaveLength(1);
    expect(result[0].currency).toBe('USD');
  });

  it('treats receipt with null currency as SGD and excludes it (defensive runtime check)', () => {
    const receipt = { ...makeReceipt('SGD'), currency: null as unknown as string };
    const result = getForeignReceiptRates([receipt], rates);
    // null ?? BASE_CURRENCY = 'SGD' → skipped
    expect(result).toEqual([]);
  });
});
