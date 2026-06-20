import { describe, expect, it } from 'vitest';
import type { ChargeState, Receipt, SplitResult } from '@shared/types';
import { buildSummaryExportPayload } from './buildSummaryExportPayload';
import type { SummaryBreakdown } from './summaryBreakdown';

const disabledChargeState: ChargeState = {
  enabled: false,
  mode: 'amount',
  amountInput: '',
  percentInput: '',
  detectedConfidence: null,
  detectedSource: null,
};

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

const summaryBreakdown: SummaryBreakdown = {
  personBreakdowns: [],
  unassignedItemCount: 0,
};

describe('buildSummaryExportPayload', () => {
  it('maps foreign receipt view fields into the renderer payload', () => {
    const payload = buildSummaryExportPayload({
      model: {
        summaryBreakdown,
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
    });

    expect(payload.receiptName).toBe('Tokyo Lunch');
    expect(payload.currency).toBe('JPY');
    expect(payload.split).toBe(split);
    expect(payload.reconciliationCents).toBe(-25);
    expect(payload.includeItemDetails).toBe(true);
    expect(payload.summaryBreakdown).toBe(summaryBreakdown);
  });

  it('maps total-tab payload fields without leaking renderer-derivable data', () => {
    const payload = buildSummaryExportPayload({
      model: {
        summaryBreakdown,
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
              discount: disabledChargeState,
              serviceCharge: disabledChargeState,
              gst: disabledChargeState,
              effectiveRate: 95,
            },
          ],
        },
      },
      includeItemDetails: false,
    });

    expect(payload.receiptName).toBeUndefined();
    expect(payload.currency).toBe('SGD');
    expect(payload.split).toBe(split);
    expect(payload.includeItemDetails).toBe(false);
    expect(payload.summaryBreakdown).toBe(summaryBreakdown);
    expect(payload).not.toHaveProperty('receipts');
    expect(payload).not.toHaveProperty('splitByReceipt');
    expect(payload).not.toHaveProperty('payerMobile');
  });
});
