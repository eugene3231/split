import { describe, expect, it } from 'vitest';
import type { ChargeState, Person, PersonReceiptLineItem, SplitResult } from '@shared/types';
import { resolveSummaryBreakdown } from './summaryBreakdown';
import type { SummaryView } from './summaryView';

const disabledCharge: ChargeState = {
  enabled: false,
  mode: 'amount',
  amountInput: '',
  percentInput: '',
  detectedConfidence: null,
  detectedSource: null,
};

function percentCharge(percentInput: string): ChargeState {
  return {
    enabled: true,
    mode: 'percent',
    amountInput: '',
    percentInput,
    detectedConfidence: null,
    detectedSource: null,
  };
}

const alice: Person = { id: 'alice', name: 'Alice' };
const bob: Person = { id: 'bob', name: 'Bob' };

function line(overrides: Partial<PersonReceiptLineItem> = {}): PersonReceiptLineItem {
  return {
    itemId: 'item-1',
    name: 'Noodles',
    grossAmountCents: 1200,
    discountPercent: 0,
    discountAmountCents: 0,
    netAmountCents: 1200,
    assignedAmountCents: 1200,
    splitCount: 1,
    involved: true,
    ...overrides,
  };
}

function split(overrides: Partial<SplitResult> = {}): SplitResult {
  return {
    lineItemsByPerson: { alice: [line()] },
    involvedCountByPerson: { alice: 1 },
    subtotalByPersonCents: { alice: 1200 },
    discountByPersonCents: { alice: 0 },
    serviceByPersonCents: { alice: 0 },
    gstByPersonCents: { alice: 0 },
    totalByPersonCents: { alice: 1200 },
    subtotalCents: 1200,
    discountCents: 0,
    serviceChargeCents: 0,
    gstCents: 0,
    grandTotalCents: 1200,
    unassignedItemCount: 0,
    ...overrides,
  };
}

describe('resolveSummaryBreakdown', () => {
  it('resolves single-receipt person rows and charge rows', () => {
    const view: SummaryView = {
      kind: 'receipt',
      receipt: {
        id: 'r1',
        name: 'Dinner',
        items: [],
        discount: percentCharge('5'),
        serviceCharge: percentCharge('10'),
        gst: percentCharge('9'),
        receiptTotalInput: '',
        currency: 'SGD',
        exchangeRateOverride: null,
      },
      displaySplit: split({
        discountByPersonCents: { alice: 60 },
        serviceByPersonCents: { alice: 120 },
        gstByPersonCents: { alice: 108 },
        totalByPersonCents: { alice: 1368 },
      }),
      displayCurrency: 'SGD',
      grandTotal: 1368,
      discount: percentCharge('5'),
      serviceCharge: percentCharge('10'),
      gst: percentCharge('9'),
      sgdSplit: split(),
      nativeCurrency: 'SGD',
      isForeign: false,
      effectiveRate: null,
    };

    const breakdown = resolveSummaryBreakdown({
      people: [alice],
      view,
      qrDataUrls: { alice: 'data:image/png;base64,qr' },
    });

    expect(breakdown.personBreakdowns).toHaveLength(1);
    const person = breakdown.personBreakdowns[0];
    expect(person.headerLabel).toBe('Total Due');
    expect(person.totalCents).toBe(1368);
    expect(person.sections[0].totalCents).toBe(1368);
    expect(person.qrDataUrl).toBe('data:image/png;base64,qr');
    expect(person.sections[0].itemRows).toMatchObject([
      { label: 'Noodles', amountCents: 1200, involved: true, currency: 'SGD' },
    ]);
    expect(person.sections[0].chargeRows).toEqual([
      {
        kind: 'discount',
        label: 'Discount (5%)',
        amountCents: 60,
        sign: 'minus',
        currency: 'SGD',
      },
      {
        kind: 'service',
        label: 'Service Charge (10%)',
        amountCents: 120,
        sign: 'plus',
        currency: 'SGD',
      },
      {
        kind: 'gst',
        label: 'GST / Tax (9%)',
        amountCents: 108,
        sign: 'plus',
        currency: 'SGD',
      },
    ]);
  });

  it('omits a second SGD conversion when a foreign receipt is displayed in SGD', () => {
    const view: SummaryView = {
      kind: 'receipt',
      receipt: null,
      displaySplit: split({ totalByPersonCents: { alice: 1620 }, grandTotalCents: 1620 }),
      displayCurrency: 'SGD',
      grandTotal: 1620,
      discount: disabledCharge,
      serviceCharge: disabledCharge,
      gst: disabledCharge,
      sgdSplit: split({ totalByPersonCents: { alice: 1620 }, grandTotalCents: 1620 }),
      nativeCurrency: 'USD',
      isForeign: true,
      effectiveRate: 1.35,
    };

    const [person] = resolveSummaryBreakdown({ people: [alice], view }).personBreakdowns;

    expect(person.currency).toBe('SGD');
    expect(person.conversion).toBeUndefined();
  });

  it('includes receipt charges in expanded and collapsed totals', () => {
    const chargedSplit = split({
      discountByPersonCents: { alice: 100 },
      serviceByPersonCents: { alice: 200 },
      gstByPersonCents: { alice: 90 },
      totalByPersonCents: { alice: 1390 },
    });
    const view: SummaryView = {
      kind: 'total',
      displaySplit: chargedSplit,
      displayCurrency: 'SGD',
      grandTotal: 1390,
      discount: disabledCharge,
      serviceCharge: disabledCharge,
      gst: disabledCharge,
      sgdSplit: chargedSplit,
      hasAnyForeign: false,
      foreignRates: [],
      receiptBreakdowns: [
        {
          name: 'Dinner',
          split: chargedSplit,
          currency: 'SGD',
          discount: percentCharge('8.33'),
          serviceCharge: percentCharge('16.67'),
          gst: percentCharge('7.5'),
        },
      ],
    };

    const [person] = resolveSummaryBreakdown({ people: [alice], view }).personBreakdowns;

    expect(person.totalCents).toBe(1390);
    expect(person.sections[0].totalCents).toBe(1390);
    expect(person.collapsedReceiptTotals[0].totalCents).toBe(1390);
    expect(person.sections[0].itemRows[0].amountCents).toBe(1200);
    expect(person.sections[0].chargeRows.map((row) => row.amountCents)).toEqual([100, 200, 90]);
  });

  it('resolves total-tab receipt sections and collapsed totals per person', () => {
    const ramenSplit = split({
      lineItemsByPerson: { alice: [line({ itemId: 'ramen', name: 'Ramen' })] },
      totalByPersonCents: { alice: 1200 },
    });
    const teaSplit = split({
      lineItemsByPerson: {
        alice: [line({ itemId: 'tea', name: 'Tea', assignedAmountCents: 300 })],
      },
      totalByPersonCents: { alice: 300 },
    });
    const view: SummaryView = {
      kind: 'total',
      displaySplit: split({ totalByPersonCents: { alice: 1800 }, grandTotalCents: 1800 }),
      displayCurrency: 'SGD',
      grandTotal: 1800,
      discount: disabledCharge,
      serviceCharge: disabledCharge,
      gst: disabledCharge,
      sgdSplit: split(),
      hasAnyForeign: true,
      foreignRates: [],
      receiptBreakdowns: [
        {
          name: 'Ramen Shop',
          split: ramenSplit,
          currency: 'JPY',
          discount: disabledCharge,
          serviceCharge: disabledCharge,
          gst: disabledCharge,
          effectiveRate: 0.009,
        },
        {
          name: 'Tea Stall',
          split: teaSplit,
          currency: 'SGD',
          discount: disabledCharge,
          serviceCharge: disabledCharge,
          gst: disabledCharge,
          effectiveRate: undefined,
        },
      ],
    };

    const [person] = resolveSummaryBreakdown({ people: [alice], view }).personBreakdowns;

    expect(person.headerLabel).toBe('Grand Total Due');
    expect(person.collapsedReceiptTotals).toEqual([
      { id: '0:Ramen Shop', label: 'Ramen Shop', totalCents: 1200, currency: 'JPY' },
      { id: '1:Tea Stall', label: 'Tea Stall', totalCents: 300, currency: 'SGD' },
    ]);
    expect(person.sections.map((section) => section.title)).toEqual(['Ramen Shop', 'Tea Stall']);
    expect(person.sections[0].conversion).toEqual({
      amountCents: 11,
      rate: 0.009,
      fromCurrency: 'JPY',
      toCurrency: 'SGD',
    });
  });

  it('keeps uninvolved item rows semantic instead of formatting them', () => {
    const view: SummaryView = {
      kind: 'receipt',
      receipt: null,
      displaySplit: split({
        lineItemsByPerson: {
          alice: [line({ involved: false, assignedAmountCents: 0 })],
        },
        totalByPersonCents: { alice: 0 },
      }),
      displayCurrency: 'SGD',
      grandTotal: 0,
      discount: disabledCharge,
      serviceCharge: disabledCharge,
      gst: disabledCharge,
      sgdSplit: split(),
      nativeCurrency: 'SGD',
      isForeign: false,
      effectiveRate: null,
    };

    const [person] = resolveSummaryBreakdown({ people: [alice], view }).personBreakdowns;

    expect(person.sections[0].itemRows[0]).toMatchObject({
      amountCents: null,
      involved: false,
    });
  });

  it('returns empty state metadata when no people are present', () => {
    const view: SummaryView = {
      kind: 'total',
      displaySplit: split({ unassignedItemCount: 2 }),
      displayCurrency: 'SGD',
      grandTotal: 0,
      discount: disabledCharge,
      serviceCharge: disabledCharge,
      gst: disabledCharge,
      sgdSplit: split(),
      hasAnyForeign: false,
      foreignRates: [],
      receiptBreakdowns: [],
    };

    const breakdown = resolveSummaryBreakdown({ people: [], view });

    expect(breakdown.emptyPeopleMessage).toBe('Add people to see the breakdown.');
    expect(breakdown.unassignedItemCount).toBe(2);
    expect(breakdown.personBreakdowns).toEqual([]);
  });

  it('marks a person with no assigned sections as empty', () => {
    const view: SummaryView = {
      kind: 'total',
      displaySplit: split({ lineItemsByPerson: {}, totalByPersonCents: { bob: 0 } }),
      displayCurrency: 'SGD',
      grandTotal: 0,
      discount: disabledCharge,
      serviceCharge: disabledCharge,
      gst: disabledCharge,
      sgdSplit: split(),
      hasAnyForeign: false,
      foreignRates: [],
      receiptBreakdowns: [
        {
          name: 'Dinner',
          split: split({ lineItemsByPerson: {}, totalByPersonCents: { bob: 0 } }),
          currency: 'SGD',
          discount: disabledCharge,
          serviceCharge: disabledCharge,
          gst: disabledCharge,
        },
      ],
    };

    const [person] = resolveSummaryBreakdown({ people: [bob], view }).personBreakdowns;

    expect(person.sections).toEqual([]);
    expect(person.emptyMessage).toBe('No items assigned.');
  });
});
