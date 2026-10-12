import { describe, expect, it } from 'vitest';
import { computeSplit } from '@features/split-workspace/logic/split/split';
import {
  amountCharge,
  disabledCharge,
  makeItem,
  makeReceipt,
  makeSplit,
} from '../../../tests/integration/testHelpers';
import type { SplitLine } from '@shared/types';
import {
  convertCents,
  convertSplitResult,
  getEffectiveRate,
} from '@features/split-workspace/logic/exchangeRates';
import { equalShares } from '@features/split-workspace/logic/assignment';
import { centsByPerson } from '@features/split-workspace/logic/split/amounts';

const rates: Record<string, number> = {
  SGD: 1,
  USD: 1.35,
  THB: 0.038,
  JPY: 0.009,
};

function line(itemId: string, amountCents: number): SplitLine {
  return { itemId, name: itemId, amountCents };
}

/** Two people who shared one 5.00 item, with service charge and tax on top. */
function padThaiSplit() {
  return makeSplit({
    p1: { subtotalCents: 250, service: 13, gst: 11, lines: [line('i1', 250)] },
    p2: { subtotalCents: 250, service: 12, gst: 11, lines: [line('i1', 250)] },
  });
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

  it("falls back to the currency's own rate when no live rate has loaded", () => {
    expect(getEffectiveRate('EUR', {}, null)).toBe(1.48);
    expect(getEffectiveRate('SGD', {}, null)).toBe(1);
  });

  it('ignores override of 0 (treats as null)', () => {
    // override of 0 is invalid, should fall through to rates map
    expect(getEffectiveRate('USD', rates, 0)).toBe(1.35);
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
  it.each([
    ['0.01', '0.01', 3, 2],
    ['10.01', '20.01', 2703, 2702],
  ])(
    'keeps a fully discounted person nonnegative at %s per item',
    (amount, discount, subtotal, discountCents) => {
      const native = computeSplit(
        makeReceipt({
          items: ['a', 'b'].map((id) =>
            makeItem({
              id,
              amountInput: amount,
              assignment: equalShares([id]),
            }),
          ),
          discount: amountCharge(discount),
          serviceCharge: disabledCharge,
          gst: disabledCharge,
        }),
        [
          { id: 'a', name: 'A' },
          { id: 'b', name: 'B' },
        ],
      );
      const converted = convertSplitResult(native, 'USD', 'SGD', rates);
      expect(centsByPerson(converted, 'total')).toEqual({ a: 0, b: 1 });
      expect(converted.totals.subtotalCents).toBe(subtotal);
      expect(converted.totals.chargeCents.discount).toBe(discountCents);
      expect(sum(centsByPerson(converted, 'subtotal'))).toBe(subtotal);
      expect(sum(centsByPerson(converted, 'discount'))).toBe(discountCents);
      expect(sum(centsByPerson(converted, 'total'))).toBe(1);
      for (const id of ['a', 'b']) {
        expect(converted.byPerson[id].subtotalCents).toBeGreaterThanOrEqual(
          converted.byPerson[id].chargeCents.discount,
        );
        expect(converted.byPerson[id].totalCents).toBe(
          converted.byPerson[id].subtotalCents - converted.byPerson[id].chargeCents.discount,
        );
        expect(
          converted.byPerson[id].lines.reduce((total, item) => total + (item.amountCents ?? 0), 0),
        ).toBe(converted.byPerson[id].subtotalCents);
      }
      if (amount === '0.01') {
        expect(centsByPerson(converted, 'subtotal')).toEqual({ a: 2, b: 1 });
        expect(centsByPerson(converted, 'discount')).toEqual({ a: 2, b: 0 });
      }
    },
  );

  it('repairs multiple deficits from multiple donors without changing discount recipients', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    const native = computeSplit(
      makeReceipt({
        items: ids.map((id) =>
          makeItem({
            id,
            amountInput: '0.01',
            assignment: equalShares([id]),
          }),
        ),
        discount: amountCharge('0.05'),
        serviceCharge: disabledCharge,
        gst: disabledCharge,
      }),
      ids.map((id) => ({ id, name: id })),
    );
    const converted = convertSplitResult(native, 'USD', 'SGD', rates);
    expect(centsByPerson(converted, 'subtotal')).toEqual({
      a: 2,
      b: 2,
      c: 1,
      d: 1,
      e: 1,
      f: 2,
      g: 2,
      h: 1,
      i: 1,
      j: 1,
    });
    expect(centsByPerson(converted, 'discount')).toEqual({
      a: 2,
      b: 2,
      c: 1,
      d: 1,
      e: 1,
      f: 0,
      g: 0,
      h: 0,
      i: 0,
      j: 0,
    });
    expect(centsByPerson(converted, 'total')).toEqual({
      a: 0,
      b: 0,
      c: 0,
      d: 0,
      e: 0,
      f: 2,
      g: 2,
      h: 1,
      i: 1,
      j: 1,
    });
    expect(sum(centsByPerson(converted, 'subtotal'))).toBe(14);
    expect(sum(centsByPerson(converted, 'discount'))).toBe(7);
    expect(sum(centsByPerson(converted, 'total'))).toBe(7);
    for (const id of ids) {
      expect(
        converted.byPerson[id].lines.reduce((total, item) => total + (item.amountCents ?? 0), 0),
      ).toBe(converted.byPerson[id].subtotalCents);
    }
  });

  it('returns the same result unchanged when currencies are identical', () => {
    const split = padThaiSplit();
    const result = convertSplitResult(split, 'SGD', 'SGD', rates);
    expect(result).toBe(split); // same reference
  });

  it('converts all monetary fields from USD to SGD', () => {
    // $10.00 of food, $1.00 service and $1.00 tax, shared evenly
    const split = makeSplit({
      p1: { subtotalCents: 500, service: 50, gst: 50, lines: [line('a', 500)] },
      p2: { subtotalCents: 500, service: 50, gst: 50, lines: [line('b', 500)] },
    });

    const result = convertSplitResult(split, 'USD', 'SGD', rates);

    // 1 USD = 1.35 SGD
    expect(result.totals.subtotalCents).toBe(1350);
    expect(result.totals.totalCents).toBe(1620);
    expect(result.totals.chargeCents.service).toBe(135);
    expect(result.totals.chargeCents.gst).toBe(135);
    expect(centsByPerson(result, 'subtotal')).toEqual({ p1: 675, p2: 675 });
    expect(centsByPerson(result, 'total')).toEqual({ p1: 810, p2: 810 });
  });

  it('balances tied charge cents between people with equal native totals', () => {
    const split = makeSplit({
      p1: { subtotalCents: 500, service: 50, gst: 50, lines: [line('a', 500)] },
      p2: { subtotalCents: 500, service: 50, gst: 50, lines: [line('b', 500)] },
    });

    const converted = convertSplitResult(split, 'USD', 'SGD', rates);

    expect(centsByPerson(converted, 'service')).toEqual({ p1: 68, p2: 67 });
    expect(centsByPerson(converted, 'gst')).toEqual({ p1: 67, p2: 68 });
    expect(centsByPerson(converted, 'total')).toEqual({ p1: 810, p2: 810 });
    expect(converted.totals.totalCents).toBe(1620);
  });

  it('converts line item amounts', () => {
    const split = padThaiSplit(); // each person's line is 250
    const result = convertSplitResult(split, 'USD', 'SGD', rates);

    // 250 USD cents * 1.35 = 337.5 → 338 SGD cents
    expect(result.byPerson.p1.lines[0].amountCents).toBe(338);
    expect(result.byPerson.p2.lines[0].amountCents).toBe(337);
  });

  it('converts the receipt once and allocates its rounding cent across people', () => {
    const split = makeSplit({
      p1: { subtotalCents: 1001, lines: [line('a', 1001)] },
      p2: { subtotalCents: 1001, lines: [line('b', 1001)] },
    });

    const converted = convertSplitResult(split, 'USD', 'SGD', rates);

    expect(converted.totals.totalCents).toBe(2703);
    expect(centsByPerson(converted, 'total')).toEqual({ p1: 1352, p2: 1351 });
    expect(converted.byPerson.p1.lines[0].amountCents).toBe(1352);
    expect(converted.byPerson.p2.lines[0].amountCents).toBe(1351);
  });

  it('balances categories and item lines through discounts, service, and GST', () => {
    const split = makeSplit({
      p1: {
        subtotalCents: 1002,
        discount: 1,
        service: 1,
        gst: 1,
        lines: [line('discounted', 1001), line('small', 1)],
      },
      p2: { subtotalCents: 1001, discount: 1, service: 1, lines: [line('other', 1001)] },
    });

    const converted = convertSplitResult(split, 'USD', 'SGD', rates);

    expect(converted.totals.totalCents).toBe(2705);
    expect(converted.totals.subtotalCents).toBe(2704);
    expect(converted.totals.chargeCents.discount).toBe(3);
    expect(converted.totals.chargeCents.service).toBe(3);
    expect(converted.totals.chargeCents.gst).toBe(1);
    expect(converted.byPerson.p1.lines.map((item) => item.amountCents)).toEqual([1352, 1]);
    expect(sum(centsByPerson(converted, 'subtotal'))).toBe(converted.totals.subtotalCents);
    expect(sum(centsByPerson(converted, 'discount'))).toBe(converted.totals.chargeCents.discount);
    expect(sum(centsByPerson(converted, 'service'))).toBe(converted.totals.chargeCents.service);
    expect(sum(centsByPerson(converted, 'gst'))).toBe(converted.totals.chargeCents.gst);
    expect(sum(centsByPerson(converted, 'total'))).toBe(converted.totals.totalCents);
    expect(
      converted.totals.subtotalCents -
        converted.totals.chargeCents.discount +
        converted.totals.chargeCents.service +
        converted.totals.chargeCents.gst,
    ).toBe(converted.totals.totalCents);
    for (const personId of ['p1', 'p2']) {
      expect(
        converted.byPerson[personId].lines.reduce(
          (total, item) => total + (item.amountCents ?? 0),
          0,
        ),
      ).toBe(converted.byPerson[personId].subtotalCents);
      expect(converted.byPerson[personId].totalCents).toBe(
        converted.byPerson[personId].subtotalCents -
          converted.byPerson[personId].chargeCents.discount +
          converted.byPerson[personId].chargeCents.service +
          converted.byPerson[personId].chargeCents.gst,
      );
    }
  });

  it('applies user override rate to the conversion', () => {
    const split = makeSplit({ p1: { subtotalCents: 1000 } });
    const result = convertSplitResult(split, 'USD', 'SGD', rates, 1.5);
    // 1000 cents * 1.5 = 1500 SGD cents
    expect(result.totals.subtotalCents).toBe(1500);
    expect(result.totals.totalCents).toBe(1500);
  });
});
