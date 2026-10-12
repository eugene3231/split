import { describe, expect, it } from 'vitest';
import type { ChargeState, Receipt, SplitResult } from '@shared/types';
import { resolveSummaryView } from './summaryView';
import type { ResolveSummaryViewInput } from './summaryView';
import { makeSplit as buildSplit } from '../../../tests/integration/testHelpers';
import type { CurrencyCode } from '@shared/constants';

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

function makeReceipt(
  id: string,
  currency: CurrencyCode = 'SGD',
  override: number | null = null,
): Receipt {
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
  return buildSplit({ p1: { subtotalCents: total } });
}

function makeInput(overrides: Partial<ResolveSummaryViewInput> = {}): ResolveSummaryViewInput {
  return {
    receiptSplits: [{ receipt: makeReceipt('r0'), split: makeSplit(0) }],
    consolidated: makeSplit(0),
    exchangeRates: rates,
    activeTab: 'total',
    showBaseCurrency: false,
    ...overrides,
  };
}

// ─── Total tab ────────────────────────────────────────────────────────────────

describe('resolveSummaryView — total tab', () => {
  it('returns kind:total with the consolidated split as displaySplit', () => {
    const consolidated = makeSplit(3000);
    const view = resolveSummaryView(makeInput({ consolidated: consolidated, activeTab: 'total' }));
    expect(view.kind).toBe('total');
    if (view.kind !== 'total') return;
    expect(view.displaySplit).toBe(consolidated);
    expect(view.displayCurrency).toBe('SGD');
  });

  it('totals the consolidated split', () => {
    const view = resolveSummaryView(
      makeInput({ consolidated: makeSplit(5000), activeTab: 'total' }),
    );
    expect(view.displaySplit.totals.totalCents).toBe(5000);
  });

  it('baseSplit is the consolidated split on total tab', () => {
    const consolidated = makeSplit(3000);
    const view = resolveSummaryView(makeInput({ consolidated: consolidated, activeTab: 'total' }));
    expect(view.baseSplit).toBe(consolidated);
  });

  it('hasAnyForeign is true when at least one receipt is non-SGD', () => {
    const view = resolveSummaryView(
      makeInput({
        receiptSplits: [
          { receipt: makeReceipt('r1', 'SGD'), split: makeSplit(1000) },
          { receipt: makeReceipt('r2', 'USD'), split: makeSplit(500) },
        ],
        activeTab: 'total',
      }),
    );
    if (view.kind !== 'total') return;
    expect(view.hasAnyForeign).toBe(true);
  });

  it('hasAnyForeign is false when all receipts are SGD', () => {
    const view = resolveSummaryView(
      makeInput({
        receiptSplits: [
          { receipt: makeReceipt('r1'), split: makeSplit(1000) },
          { receipt: makeReceipt('r2'), split: makeSplit(2000) },
        ],
        activeTab: 'total',
      }),
    );
    if (view.kind !== 'total') return;
    expect(view.hasAnyForeign).toBe(false);
  });

  it('billedCurrencies lists each receipt currency once, in receipt order', () => {
    const view = resolveSummaryView(
      makeInput({
        receiptSplits: [
          { receipt: makeReceipt('r1', 'USD'), split: makeSplit(500) },
          { receipt: makeReceipt('r2', 'JPY'), split: makeSplit(50000) },
          { receipt: makeReceipt('r3', 'USD'), split: makeSplit(200) },
        ],
        activeTab: 'total',
      }),
    );
    if (view.kind !== 'total') return;
    expect(view.billedCurrencies).toEqual(['USD', 'JPY']);
  });

  it('totals in the shared currency as billed when every receipt uses it', () => {
    const view = resolveSummaryView(
      makeInput({
        receiptSplits: [
          { receipt: makeReceipt('r1', 'USD'), split: makeSplit(500) },
          { receipt: makeReceipt('r2', 'USD'), split: makeSplit(200) },
        ],
        consolidated: makeSplit(945),
        activeTab: 'total',
      }),
    );
    if (view.kind !== 'total') return;
    expect(view.displayCurrency).toBe('USD');
    expect(view.displaySplit.byPerson.p1.totalCents).toBe(700);
    expect(view.displaySplit.totals.totalCents).toBe(700);
    expect(view.billedRate).toBe(1.35);
    expect(view.baseSplit.byPerson.p1.totalCents).toBe(945);
  });

  it('totals in SGD when the toggle asks for it, even with one shared currency', () => {
    const consolidated = makeSplit(945);
    const view = resolveSummaryView(
      makeInput({
        receiptSplits: [
          { receipt: makeReceipt('r1', 'USD'), split: makeSplit(500) },
          { receipt: makeReceipt('r2', 'USD'), split: makeSplit(200) },
        ],
        consolidated: consolidated,
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
        receiptSplits: [
          { receipt: makeReceipt('r1', 'USD'), split: makeSplit(500) },
          { receipt: makeReceipt('r2', 'JPY'), split: makeSplit(50000) },
        ],
        consolidated: consolidated,
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
        receiptSplits: [
          { receipt: makeReceipt('r1', 'USD'), split: makeSplit(500) },
          { receipt: makeReceipt('r2', 'USD', 1.4), split: makeSplit(200) },
        ],
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
        receiptSplits: [{ receipt: r1, split: s1 }],
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
        receiptSplits: [{ receipt: r1, split: s1 }],
        activeTab: 'total',
        showBaseCurrency: true,
      }),
    );
    if (view.kind !== 'total') return;
    expect(view.receiptBreakdowns[0].currency).toBe('SGD');
    // 500 USD cents * 1.35 = 675 SGD cents
    expect(view.receiptBreakdowns[0].split.byPerson.p1.totalCents).toBe(675);
  });

  it('uses "Receipt N" name when receipt name is empty', () => {
    const r1 = { ...makeReceipt('r1', 'SGD'), name: '' };
    const view = resolveSummaryView(
      makeInput({
        receiptSplits: [{ receipt: r1, split: makeSplit(1000) }],
        activeTab: 'total',
      }),
    );
    if (view.kind !== 'total') return;
    expect(view.receiptBreakdowns[0].name).toBe('Receipt 1');
  });

  it('carries each receipt in receiptBreakdowns, for its charge settings', () => {
    const r1 = makeReceipt('r1', 'SGD');
    const view = resolveSummaryView(
      makeInput({
        receiptSplits: [{ receipt: r1, split: makeSplit(1000) }],
        activeTab: 'total',
      }),
    );
    if (view.kind !== 'total') return;
    expect(view.receiptBreakdowns[0].receipt).toBe(r1);
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
        receiptSplits: [{ receipt: r1, split: sgdSplit }],
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
        receiptSplits: [{ receipt: r2, split: usdSplit }],
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
        receiptSplits: [{ receipt: r2, split: usdSplit }],
        activeTab: 'r2',
        showBaseCurrency: true,
      }),
    );
    if (view.kind !== 'receipt') return;
    expect(view.displayCurrency).toBe('SGD');
    // 500 USD cents * 1.35 = 675 SGD cents
    expect(view.displaySplit.byPerson.p1.totalCents).toBe(675);
  });

  it('baseSplit is converted to SGD for foreign receipt', () => {
    const view = resolveSummaryView(
      makeInput({
        receiptSplits: [{ receipt: r2, split: usdSplit }],
        activeTab: 'r2',
      }),
    );
    if (view.kind !== 'receipt') return;
    expect(view.baseSplit.byPerson.p1.totalCents).toBe(675);
  });

  it('baseSplit equals nativeSplit for SGD receipt', () => {
    const view = resolveSummaryView(
      makeInput({
        receiptSplits: [{ receipt: r1, split: sgdSplit }],
        activeTab: 'r1',
      }),
    );
    if (view.kind !== 'receipt') return;
    expect(view.baseSplit).toBe(sgdSplit);
  });

  it('uses override rate when set on receipt', () => {
    const r3 = makeReceipt('r3', 'USD', 1.5);
    const view = resolveSummaryView(
      makeInput({
        receiptSplits: [{ receipt: r3, split: usdSplit }],
        activeTab: 'r3',
      }),
    );
    if (view.kind !== 'receipt') return;
    expect(view.effectiveRate).toBe(1.5);
    // 500 cents * 1.5 = 750 SGD cents
    expect(view.baseSplit.byPerson.p1.totalCents).toBe(750);
  });

  it('shows every receipt when activeTab matches none of them', () => {
    const consolidated = makeSplit(1000);
    const view = resolveSummaryView(
      makeInput({
        receiptSplits: [{ receipt: r1, split: sgdSplit }],
        consolidated: consolidated,
        activeTab: 'unknown-id',
      }),
    );
    expect(view.kind).toBe('total');
    expect(view.displaySplit).toBe(consolidated);
  });

  it('totals the displayed split', () => {
    const view = resolveSummaryView(
      makeInput({
        receiptSplits: [{ receipt: r1, split: sgdSplit }],
        activeTab: 'r1',
      }),
    );
    expect(view.displaySplit.totals.totalCents).toBe(1000);
  });
});
