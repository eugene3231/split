import { describe, expect, it } from 'vitest';
import type { ChargeState, Receipt, SplitResult } from '@shared/types';
import { resolveSummaryView, soleReceipt } from './summaryView';
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

describe('resolveSummaryView — every receipt combined', () => {
  it('totals the consolidated split in the base currency', () => {
    const consolidated = makeSplit(3000);
    const view = resolveSummaryView(makeInput({ consolidated, activeTab: 'total' }));
    expect(view.scope).toBe('all');
    expect(view.total.split).toBe(consolidated);
    expect(view.total.baseSplit).toBe(consolidated);
    expect(view.total.currency).toBe('SGD');
    expect(view.total.split.totals.totalCents).toBe(3000);
    expect(soleReceipt(view)).toBeNull();
  });

  it('lists each billed currency once, in receipt order', () => {
    const view = resolveSummaryView(
      makeInput({
        receiptSplits: [
          { receipt: makeReceipt('r1', 'USD'), split: makeSplit(500) },
          { receipt: makeReceipt('r2', 'JPY'), split: makeSplit(50000) },
          { receipt: makeReceipt('r3', 'USD'), split: makeSplit(200) },
        ],
      }),
    );
    expect(view.billedCurrencies).toEqual(['USD', 'JPY']);
  });

  it('lists only the base currency when every receipt is billed in it', () => {
    const view = resolveSummaryView(
      makeInput({
        receiptSplits: [
          { receipt: makeReceipt('r1'), split: makeSplit(1000) },
          { receipt: makeReceipt('r2'), split: makeSplit(2000) },
        ],
      }),
    );
    expect(view.billedCurrencies).toEqual(['SGD']);
    expect(view.total.rate).toBeNull();
  });

  it('totals in the shared currency as billed when every receipt uses it', () => {
    const view = resolveSummaryView(
      makeInput({
        receiptSplits: [
          { receipt: makeReceipt('r1', 'USD'), split: makeSplit(500) },
          { receipt: makeReceipt('r2', 'USD'), split: makeSplit(200) },
        ],
        consolidated: makeSplit(945),
      }),
    );
    expect(view.total.currency).toBe('USD');
    expect(view.total.split.byPerson.p1.totalCents).toBe(700);
    expect(view.total.split.totals.totalCents).toBe(700);
    expect(view.total.rate).toBe(1.35);
    expect(view.total.baseSplit.byPerson.p1.totalCents).toBe(945);
  });

  it('totals in SGD when the toggle asks for it, even with one shared currency', () => {
    const consolidated = makeSplit(945);
    const view = resolveSummaryView(
      makeInput({
        receiptSplits: [
          { receipt: makeReceipt('r1', 'USD'), split: makeSplit(500) },
          { receipt: makeReceipt('r2', 'USD'), split: makeSplit(200) },
        ],
        consolidated,
        showBaseCurrency: true,
      }),
    );
    expect(view.total.currency).toBe('SGD');
    expect(view.total.split).toBe(consolidated);
  });

  it('falls back to SGD totals when receipts use different currencies', () => {
    const consolidated = makeSplit(1125);
    const view = resolveSummaryView(
      makeInput({
        receiptSplits: [
          { receipt: makeReceipt('r1', 'USD'), split: makeSplit(500) },
          { receipt: makeReceipt('r2', 'JPY'), split: makeSplit(50000) },
        ],
        consolidated,
      }),
    );
    expect(view.total.currency).toBe('SGD');
    expect(view.total.split).toBe(consolidated);
    expect(view.total.rate).toBeNull();
  });

  it('has no single rate when two currencies happen to convert at the same one', () => {
    const view = resolveSummaryView(
      makeInput({
        receiptSplits: [
          { receipt: makeReceipt('r1', 'USD', 1.2), split: makeSplit(500) },
          { receipt: makeReceipt('r2', 'JPY', 1.2), split: makeSplit(50000) },
        ],
      }),
    );
    expect(view.total.rate).toBeNull();
  });

  it('has no single rate when one receipt has its own', () => {
    const view = resolveSummaryView(
      makeInput({
        receiptSplits: [
          { receipt: makeReceipt('r1', 'USD'), split: makeSplit(500) },
          { receipt: makeReceipt('r2', 'USD', 1.4), split: makeSplit(200) },
        ],
      }),
    );
    expect(view.total.currency).toBe('USD');
    expect(view.total.rate).toBeNull();
    expect(view.receipts.map((entry) => entry.rate)).toEqual([1.35, 1.4]);
  });

  it('shows each receipt as billed until the base currency is asked for', () => {
    const r1 = makeReceipt('r1', 'USD');
    const s1 = makeSplit(500);
    const billed = resolveSummaryView(makeInput({ receiptSplits: [{ receipt: r1, split: s1 }] }));
    expect(billed.receipts[0].receipt).toBe(r1);
    expect(billed.receipts[0].currency).toBe('USD');
    expect(billed.receipts[0].split).toBe(s1);

    const base = resolveSummaryView(
      makeInput({ receiptSplits: [{ receipt: r1, split: s1 }], showBaseCurrency: true }),
    );
    expect(base.receipts[0].currency).toBe('SGD');
    // 500 USD cents * 1.35 = 675 SGD cents
    expect(base.receipts[0].split.byPerson.p1.totalCents).toBe(675);
  });

  it('shows every receipt when activeTab matches none of them', () => {
    const consolidated = makeSplit(1000);
    const view = resolveSummaryView(
      makeInput({
        receiptSplits: [{ receipt: makeReceipt('r1'), split: makeSplit(1000) }],
        consolidated,
        activeTab: 'unknown-id',
      }),
    );
    expect(view.scope).toBe('all');
    expect(view.total.split).toBe(consolidated);
  });
});

describe('resolveSummaryView — one receipt', () => {
  const r1 = makeReceipt('r1', 'SGD');
  const r2 = makeReceipt('r2', 'USD');
  const sgdSplit = makeSplit(1000);
  const usdSplit = makeSplit(500);

  it('is the one-receipt case of the same shape', () => {
    const view = resolveSummaryView(
      makeInput({
        receiptSplits: [
          { receipt: r1, split: sgdSplit },
          { receipt: r2, split: usdSplit },
        ],
        activeTab: 'r1',
      }),
    );
    expect(view.scope).toBe('one');
    expect(soleReceipt(view)).toBe(r1);
    expect(view.receipts).toHaveLength(1);
    expect(view.total).toBe(view.receipts[0]);
    expect(view.total.split).toBe(sgdSplit);
    expect(view.total.baseSplit).toBe(sgdSplit);
    expect(view.total.currency).toBe('SGD');
    expect(view.total.rate).toBeNull();
    expect(view.total.split.totals.totalCents).toBe(1000);
    expect(view.billedCurrencies).toEqual(['SGD']);
  });

  it('shows a foreign receipt as billed, with its rate and base amounts alongside', () => {
    const view = resolveSummaryView(
      makeInput({ receiptSplits: [{ receipt: r2, split: usdSplit }], activeTab: 'r2' }),
    );
    expect(view.billedCurrencies).toEqual(['USD']);
    expect(view.total.split).toBe(usdSplit);
    expect(view.total.currency).toBe('USD');
    expect(view.total.rate).toBe(1.35);
    expect(view.total.baseSplit.byPerson.p1.totalCents).toBe(675);
  });

  it('converts a foreign receipt when the base currency is asked for, keeping its rate', () => {
    const view = resolveSummaryView(
      makeInput({
        receiptSplits: [{ receipt: r2, split: usdSplit }],
        activeTab: 'r2',
        showBaseCurrency: true,
      }),
    );
    expect(view.total.currency).toBe('SGD');
    // 500 USD cents * 1.35 = 675 SGD cents
    expect(view.total.split.byPerson.p1.totalCents).toBe(675);
    expect(view.total.rate).toBe(1.35);
  });

  it('uses the rate typed for the receipt', () => {
    const r3 = makeReceipt('r3', 'USD', 1.5);
    const view = resolveSummaryView(
      makeInput({ receiptSplits: [{ receipt: r3, split: usdSplit }], activeTab: 'r3' }),
    );
    expect(view.total.rate).toBe(1.5);
    // 500 cents * 1.5 = 750 SGD cents
    expect(view.total.baseSplit.byPerson.p1.totalCents).toBe(750);
  });

  it('names an unnamed receipt by its position among all receipts, on either tab', () => {
    const receiptSplits: ResolveSummaryViewInput['receiptSplits'] = [
      { receipt: r1, split: sgdSplit },
      { receipt: { ...r2, name: '' }, split: usdSplit },
    ];
    const combined = resolveSummaryView(makeInput({ receiptSplits }));
    const alone = resolveSummaryView(makeInput({ receiptSplits, activeTab: 'r2' }));
    expect(combined.receipts.map((entry) => entry.name)).toEqual(['Receipt r1', 'Receipt 2']);
    expect(alone.receipts[0].name).toBe('Receipt 2');
  });
});
