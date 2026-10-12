import { describe, expect, it } from 'vitest';
import type { ChargeState, Receipt, SplitResult } from '@shared/types';
import { resolveSummaryView } from './summaryView';
import type { ResolveSummaryViewInput } from './summaryView';

const rates: Record<string, number> = { SGD: 1, USD: 1.35, JPY: 0.009 };

function makeCharge(overrides: Partial<ChargeState> = {}): ChargeState {
  return {
    enabled: false,
    mode: 'percent',
    amountInput: '',
    percentInput: '',
    detectedConfidence: null,
    detectedSource: null,
    ...overrides,
  };
}

function makeReceipt(id: string, currency = 'SGD', override: number | null = null): Receipt {
  return {
    id,
    name: `Receipt ${id}`,
    items: [],
    discount: makeCharge({ percentInput: '5' }),
    serviceCharge: makeCharge({ enabled: true, percentInput: '10' }),
    gst: makeCharge({ enabled: true, percentInput: '9' }),
    receiptTotalInput: '',
    roundingInput: '',
    currency,
    exchangeRateOverride: override,
  };
}

function makeSplit(total: number): SplitResult {
  return {
    lineItemsByPerson: {},
    subtotalByPersonCents: { p1: total },
    discountByPersonCents: { p1: 0 },
    serviceByPersonCents: { p1: 0 },
    gstByPersonCents: { p1: 0 },
    roundingByPersonCents: {},
    totalByPersonCents: { p1: total },
    subtotalCents: total,
    discountCents: 0,
    serviceChargeCents: 0,
    gstCents: 0,
    roundingCents: 0,
    grandTotalCents: total,
    unassignedItemCount: 0,
  };
}

function makeInput(overrides: Partial<ResolveSummaryViewInput> = {}): ResolveSummaryViewInput {
  return {
    people: [{ id: 'p1', name: 'Alice' }],
    receipts: [],
    splitByReceipt: [],
    consolidatedSplit: makeSplit(0),
    exchangeRates: rates,
    activeTab: 'total',
    showBaseCurrency: false,
    ...overrides,
  };
}

// ─── Total tab ────────────────────────────────────────────────────────────────

describe('resolveSummaryView — total tab', () => {
  it('returns kind:total with consolidatedSplit as displaySplit', () => {
    const consolidated = makeSplit(3000);
    const view = resolveSummaryView(
      makeInput({ consolidatedSplit: consolidated, activeTab: 'total' }),
    );
    expect(view.kind).toBe('total');
    if (view.kind !== 'total') return;
    expect(view.displaySplit).toBe(consolidated);
    expect(view.displayCurrency).toBe('SGD');
  });

  it('computes grandTotal from consolidatedSplit', () => {
    const view = resolveSummaryView(
      makeInput({ consolidatedSplit: makeSplit(5000), activeTab: 'total' }),
    );
    expect(view.grandTotal).toBe(5000);
  });

  it('sgdSplit equals consolidatedSplit on total tab', () => {
    const consolidated = makeSplit(3000);
    const view = resolveSummaryView(
      makeInput({ consolidatedSplit: consolidated, activeTab: 'total' }),
    );
    expect(view.sgdSplit).toBe(consolidated);
  });

  it('hasAnyForeign is true when at least one receipt is non-SGD', () => {
    const view = resolveSummaryView(
      makeInput({
        receipts: [makeReceipt('r1', 'SGD'), makeReceipt('r2', 'USD')],
        splitByReceipt: [makeSplit(1000), makeSplit(500)],
        activeTab: 'total',
      }),
    );
    if (view.kind !== 'total') return;
    expect(view.hasAnyForeign).toBe(true);
  });

  it('hasAnyForeign is false when all receipts are SGD', () => {
    const view = resolveSummaryView(
      makeInput({
        receipts: [makeReceipt('r1'), makeReceipt('r2')],
        splitByReceipt: [makeSplit(1000), makeSplit(2000)],
        activeTab: 'total',
      }),
    );
    if (view.kind !== 'total') return;
    expect(view.hasAnyForeign).toBe(false);
  });

  it('billedCurrencies lists each receipt currency once, in receipt order', () => {
    const view = resolveSummaryView(
      makeInput({
        receipts: [makeReceipt('r1', 'USD'), makeReceipt('r2', 'JPY'), makeReceipt('r3', 'USD')],
        splitByReceipt: [makeSplit(500), makeSplit(50000), makeSplit(200)],
        activeTab: 'total',
      }),
    );
    if (view.kind !== 'total') return;
    expect(view.billedCurrencies).toEqual(['USD', 'JPY']);
  });

  it('totals in the shared currency as billed when every receipt uses it', () => {
    const view = resolveSummaryView(
      makeInput({
        receipts: [makeReceipt('r1', 'USD'), makeReceipt('r2', 'USD')],
        splitByReceipt: [makeSplit(500), makeSplit(200)],
        consolidatedSplit: makeSplit(945),
        activeTab: 'total',
      }),
    );
    if (view.kind !== 'total') return;
    expect(view.displayCurrency).toBe('USD');
    expect(view.displaySplit.totalByPersonCents.p1).toBe(700);
    expect(view.grandTotal).toBe(700);
    expect(view.billedRate).toBe(1.35);
    expect(view.sgdSplit.totalByPersonCents.p1).toBe(945);
  });

  it('totals in SGD when the toggle asks for it, even with one shared currency', () => {
    const consolidated = makeSplit(945);
    const view = resolveSummaryView(
      makeInput({
        receipts: [makeReceipt('r1', 'USD'), makeReceipt('r2', 'USD')],
        splitByReceipt: [makeSplit(500), makeSplit(200)],
        consolidatedSplit: consolidated,
        activeTab: 'total',
        showBaseCurrency: true,
      }),
    );
    expect(view.displayCurrency).toBe('SGD');
    expect(view.displaySplit).toBe(consolidated);
  });

  it('falls back to SGD totals when receipts use different currencies', () => {
    const consolidated = makeSplit(1125);
    const view = resolveSummaryView(
      makeInput({
        receipts: [makeReceipt('r1', 'USD'), makeReceipt('r2', 'JPY')],
        splitByReceipt: [makeSplit(500), makeSplit(50000)],
        consolidatedSplit: consolidated,
        activeTab: 'total',
      }),
    );
    if (view.kind !== 'total') return;
    expect(view.displayCurrency).toBe('SGD');
    expect(view.displaySplit).toBe(consolidated);
    expect(view.billedRate).toBeNull();
  });

  it('leaves billedRate empty when one receipt has its own rate', () => {
    const view = resolveSummaryView(
      makeInput({
        receipts: [makeReceipt('r1', 'USD'), makeReceipt('r2', 'USD', 1.4)],
        splitByReceipt: [makeSplit(500), makeSplit(200)],
        activeTab: 'total',
      }),
    );
    if (view.kind !== 'total') return;
    expect(view.displayCurrency).toBe('USD');
    expect(view.billedRate).toBeNull();
  });

  it('receiptBreakdowns uses native currency when showBaseCurrency=false', () => {
    const r1 = makeReceipt('r1', 'USD');
    const s1 = makeSplit(500);
    const view = resolveSummaryView(
      makeInput({
        receipts: [r1],
        splitByReceipt: [s1],
        activeTab: 'total',
        showBaseCurrency: false,
      }),
    );
    if (view.kind !== 'total') return;
    expect(view.receiptBreakdowns[0].currency).toBe('USD');
    expect(view.receiptBreakdowns[0].split).toBe(s1);
  });

  it('receiptBreakdowns uses SGD when showBaseCurrency=true', () => {
    const r1 = makeReceipt('r1', 'USD');
    const s1 = makeSplit(500); // 500 USD cents
    const view = resolveSummaryView(
      makeInput({
        receipts: [r1],
        splitByReceipt: [s1],
        activeTab: 'total',
        showBaseCurrency: true,
      }),
    );
    if (view.kind !== 'total') return;
    expect(view.receiptBreakdowns[0].currency).toBe('SGD');
    // 500 USD cents * 1.35 = 675 SGD cents
    expect(view.receiptBreakdowns[0].split.totalByPersonCents.p1).toBe(675);
  });

  it('uses BASE_CURRENCY when receipt slot is missing from receipts (splitByReceipt longer)', () => {
    // splitByReceipt longer than receipts → receipts[i]?.currency is undefined → ?? BASE_CURRENCY
    const s1 = makeSplit(500);
    const view = resolveSummaryView(
      makeInput({
        receipts: [],
        splitByReceipt: [s1],
        activeTab: 'total',
      }),
    );
    expect(view.kind).toBe('total');
    if (view.kind !== 'total') return;
    expect(view.receiptBreakdowns).toHaveLength(0);
  });

  it('uses "Receipt N" name when receipt name is empty', () => {
    const r1 = { ...makeReceipt('r1', 'SGD'), name: '' };
    const view = resolveSummaryView(
      makeInput({
        receipts: [r1],
        splitByReceipt: [makeSplit(1000)],
        activeTab: 'total',
      }),
    );
    if (view.kind !== 'total') return;
    expect(view.receiptBreakdowns[0].name).toBe('Receipt 1');
  });

  it('includes per-receipt charge metadata in receiptBreakdowns', () => {
    const r1 = makeReceipt('r1', 'SGD');
    const view = resolveSummaryView(
      makeInput({
        receipts: [r1],
        splitByReceipt: [makeSplit(1000)],
        activeTab: 'total',
      }),
    );
    if (view.kind !== 'total') return;
    expect(view.receiptBreakdowns[0].discount).toBe(r1.discount);
    expect(view.receiptBreakdowns[0].serviceCharge).toBe(r1.serviceCharge);
    expect(view.receiptBreakdowns[0].gst).toBe(r1.gst);
  });

  it('falls back to splitByReceipt[i] when sgdSplitByReceipt[i] is undefined (receipts longer than splits)', () => {
    // receipts.length > splitByReceipt.length with showBaseCurrency=true:
    // sgdSplitByReceipt is built from splitByReceipt.map(), so sgdSplitByReceipt[1] is undefined
    // → the ?? splitByReceipt[i] fallback branch is exercised
    const r1 = makeReceipt('r1', 'USD');
    const r2 = makeReceipt('r2', 'SGD');
    const s1 = makeSplit(500);
    const view = resolveSummaryView(
      makeInput({
        receipts: [r1, r2],
        splitByReceipt: [s1], // only 1 split for 2 receipts
        activeTab: 'total',
        showBaseCurrency: true,
      }),
    );
    if (view.kind !== 'total') return;
    expect(view.receiptBreakdowns).toHaveLength(2);
    expect(view.receiptBreakdowns[0].currency).toBe('SGD');
  });

  it('treats receipt with null currency as SGD (defensive runtime check)', () => {
    const r1 = { ...makeReceipt('r1', 'SGD'), currency: null as unknown as string };
    const r2 = makeReceipt('r2', 'USD');
    const view = resolveSummaryView(
      makeInput({
        receipts: [r1, r2],
        splitByReceipt: [makeSplit(1000), makeSplit(500)],
        activeTab: 'total',
        showBaseCurrency: false,
      }),
    );
    if (view.kind !== 'total') return;
    // null ?? BASE_CURRENCY → 'SGD', so r1 is not foreign
    expect(view.receiptBreakdowns[0].currency).toBe('SGD');
    expect(view.receiptBreakdowns[0].effectiveRate).toBeUndefined();
    // hasAnyForeign should still be true because r2 is USD
    expect(view.hasAnyForeign).toBe(true);
  });
});

// ─── Receipt tab ──────────────────────────────────────────────────────────────

describe('resolveSummaryView — receipt tab', () => {
  const r1 = makeReceipt('r1', 'SGD');
  const r2 = makeReceipt('r2', 'USD');
  const sgdSplit = makeSplit(1000);
  const usdSplit = makeSplit(500);

  it('returns kind:receipt with native split and currency for SGD receipt', () => {
    const view = resolveSummaryView(
      makeInput({
        receipts: [r1],
        splitByReceipt: [sgdSplit],
        activeTab: 'r1',
      }),
    );
    expect(view.kind).toBe('receipt');
    if (view.kind !== 'receipt') return;
    expect(view.receipt).toBe(r1);
    expect(view.isForeign).toBe(false);
    expect(view.displaySplit).toBe(sgdSplit);
    expect(view.displayCurrency).toBe('SGD');
    expect(view.effectiveRate).toBeNull();
  });

  it('foreign receipt with showBaseCurrency=false: displaySplit in native currency', () => {
    const view = resolveSummaryView(
      makeInput({
        receipts: [r2],
        splitByReceipt: [usdSplit],
        activeTab: 'r2',
        showBaseCurrency: false,
      }),
    );
    if (view.kind !== 'receipt') return;
    expect(view.isForeign).toBe(true);
    expect(view.displaySplit).toBe(usdSplit);
    expect(view.displayCurrency).toBe('USD');
    expect(view.effectiveRate).toBe(1.35);
  });

  it('foreign receipt with showBaseCurrency=true: displaySplit converted to SGD', () => {
    const view = resolveSummaryView(
      makeInput({
        receipts: [r2],
        splitByReceipt: [usdSplit],
        activeTab: 'r2',
        showBaseCurrency: true,
      }),
    );
    if (view.kind !== 'receipt') return;
    expect(view.displayCurrency).toBe('SGD');
    // 500 USD cents * 1.35 = 675 SGD cents
    expect(view.displaySplit.totalByPersonCents.p1).toBe(675);
  });

  it('sgdSplit is converted to SGD for foreign receipt', () => {
    const view = resolveSummaryView(
      makeInput({
        receipts: [r2],
        splitByReceipt: [usdSplit],
        activeTab: 'r2',
      }),
    );
    if (view.kind !== 'receipt') return;
    expect(view.sgdSplit.totalByPersonCents.p1).toBe(675);
  });

  it('sgdSplit equals nativeSplit for SGD receipt', () => {
    const view = resolveSummaryView(
      makeInput({
        receipts: [r1],
        splitByReceipt: [sgdSplit],
        activeTab: 'r1',
      }),
    );
    if (view.kind !== 'receipt') return;
    expect(view.sgdSplit).toBe(sgdSplit);
  });

  it('uses override rate when set on receipt', () => {
    const r3 = makeReceipt('r3', 'USD', 1.5);
    const view = resolveSummaryView(
      makeInput({
        receipts: [r3],
        splitByReceipt: [usdSplit],
        activeTab: 'r3',
      }),
    );
    if (view.kind !== 'receipt') return;
    expect(view.effectiveRate).toBe(1.5);
    // 500 cents * 1.5 = 750 SGD cents
    expect(view.sgdSplit.totalByPersonCents.p1).toBe(750);
  });

  it('shows every receipt when activeTab matches none of them', () => {
    const consolidated = makeSplit(1000);
    const view = resolveSummaryView(
      makeInput({
        receipts: [r1],
        splitByReceipt: [sgdSplit],
        consolidatedSplit: consolidated,
        activeTab: 'unknown-id',
      }),
    );
    expect(view.kind).toBe('total');
    expect(view.displaySplit).toBe(consolidated);
  });

  it('grandTotal is computed from displaySplit', () => {
    const view = resolveSummaryView(
      makeInput({
        receipts: [r1],
        splitByReceipt: [sgdSplit],
        activeTab: 'r1',
      }),
    );
    expect(view.grandTotal).toBe(1000);
  });
});
