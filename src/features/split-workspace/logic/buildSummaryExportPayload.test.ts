import { describe, expect, it } from 'vitest';
import type { ChargeState, Person, Receipt, SplitResult } from '@shared/types';
import { buildSummaryExportPayload } from './buildSummaryExportPayload';

const disabledChargeState: ChargeState = {
  enabled: false,
  mode: 'amount',
  amountInput: '',
  percentInput: '',
  detectedConfidence: null,
  detectedSource: null,
};

const people: Person[] = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
];

const split: SplitResult = {
  lineItemsByPerson: { p1: [], p2: [] },
  involvedCountByPerson: { p1: 1, p2: 1 },
  subtotalByPersonCents: { p1: 500, p2: 500 },
  discountByPersonCents: { p1: 0, p2: 0 },
  serviceByPersonCents: { p1: 0, p2: 0 },
  gstByPersonCents: { p1: 0, p2: 0 },
  subtotalCents: 1000,
  discountCents: 0,
  serviceChargeCents: 0,
  gstCents: 0,
  grandTotalCents: 1000,
  totalByPersonCents: { p1: 500, p2: 500 },
  unassignedItemCount: 0,
};

const receipts: Receipt[] = [
  {
    id: 'r1',
    name: 'Tokyo Lunch',
    items: [],
    discount: disabledChargeState,
    serviceCharge: disabledChargeState,
    gst: disabledChargeState,
    receiptTotalInput: '',
    currency: 'JPY',
    exchangeRateOverride: 95,
  },
];

describe('buildSummaryExportPayload', () => {
  it('maps foreign receipt view fields into the renderer payload', () => {
    const payload = buildSummaryExportPayload({
      model: {
        people,
        receipts,
        payerMobile: '91234567',
        splitByReceipt: [split],
        reconciliation: {
          cents: -25,
          applyCorrectiveDiscount: () => {},
        },
        view: {
          kind: 'receipt',
          receipt: receipts[0],
          displaySplit: split,
          displayCurrency: 'JPY',
          grandTotal: 1000,
          discount: disabledChargeState,
          serviceCharge: disabledChargeState,
          gst: disabledChargeState,
          sgdSplit: split,
          nativeCurrency: 'JPY',
          isForeign: true,
          effectiveRate: 95,
        },
      },
      includeItemDetails: true,
      showBaseCurrency: false,
    });

    expect(payload.receiptName).toBe('Tokyo Lunch');
    expect(payload.currency).toBe('JPY');
    expect(payload.conversionRate).toBe(95);
    expect(payload.fromCurrency).toBe('JPY');
    expect(payload.payerMobile).toBe('+6591234567');
    expect(payload.reconciliationCents).toBe(-25);
    expect(payload.includeItemDetails).toBe(true);
  });

  it('includes total-tab effective rates only for consolidated exports', () => {
    const payload = buildSummaryExportPayload({
      model: {
        people,
        receipts,
        payerMobile: '',
        splitByReceipt: [split],
        reconciliation: {
          cents: null,
          applyCorrectiveDiscount: () => {},
        },
        view: {
          kind: 'total',
          displaySplit: split,
          displayCurrency: 'SGD',
          grandTotal: 1000,
          discount: disabledChargeState,
          serviceCharge: disabledChargeState,
          gst: disabledChargeState,
          sgdSplit: split,
          hasAnyForeign: true,
          foreignRates: [],
          receiptBreakdowns: [
            {
              name: 'Tokyo Lunch',
              split,
              currency: 'JPY',
              effectiveRate: 95,
            },
          ],
        },
      },
      includeItemDetails: false,
      showBaseCurrency: true,
    });

    expect(payload.receiptName).toBeUndefined();
    expect(payload.conversionRate).toBeUndefined();
    expect(payload.fromCurrency).toBeUndefined();
    expect(payload.effectiveRatesByReceipt).toEqual([95]);
    expect(payload.payerMobile).toBeUndefined();
  });
});
