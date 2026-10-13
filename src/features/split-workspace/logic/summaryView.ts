import type { Receipt, ReceiptSplit, SplitResult } from '@shared/types';
import { BASE_CURRENCY, type CurrencyCode } from '@shared/constants';
import { consolidateSplits } from '@features/split-workspace/logic/split/split';
import {
  convertSplitResult,
  getEffectiveRate,
} from '@features/split-workspace/logic/exchangeRates';
import { mapNonEmpty, type NonEmptyArray } from '@features/split-workspace/logic/nonEmpty';

/** Amounts as the summary shows them, beside the same amounts in the base currency. */
export interface ViewAmounts {
  /** In the displayed currency. */
  split: SplitResult;
  /** In the base currency, for PayNow amounts and the "≈" lines. */
  baseSplit: SplitResult;
  currency: CurrencyCode;
  /**
   * What one unit of the billed currency is worth in the base currency. Null when billed in
   * the base currency, or when the receipts do not share one rate.
   */
  rate: number | null;
}

export interface ReceiptView extends ViewAmounts {
  receipt: Receipt;
  /** The receipt's name, or "Receipt 2" for one that has none. */
  name: string;
}

export interface SummaryView {
  /** Every receipt combined, or one receipt on its own tab. */
  scope: 'all' | 'one';
  receipts: NonEmptyArray<ReceiptView>;
  /** Everything in `receipts` added up. */
  total: ViewAmounts;
  /** Each currency the receipts were billed in, in receipt order. */
  billedCurrencies: CurrencyCode[];
}

export interface ResolveSummaryViewInput {
  receiptSplits: NonEmptyArray<ReceiptSplit>;
  /** Every receipt added up in the base currency. */
  consolidated: SplitResult;
  exchangeRates: Record<string, number>;
  /** A receipt id, or anything else (by convention `'total'`) for every receipt combined. */
  activeTab: string;
  showBaseCurrency: boolean;
}

export function resolveSummaryView({
  receiptSplits,
  consolidated,
  exchangeRates,
  activeTab,
  showBaseCurrency,
}: ResolveSummaryViewInput): SummaryView {
  const resolve = (receiptSplit: ReceiptSplit, index: number) =>
    resolveReceiptView(receiptSplit, index, exchangeRates, showBaseCurrency);

  const activeIndex = receiptSplits.findIndex(({ receipt }) => receipt.id === activeTab);
  if (activeIndex !== -1) {
    const only = resolve(receiptSplits[activeIndex], activeIndex);
    return {
      scope: 'one',
      receipts: [only],
      total: only,
      billedCurrencies: [only.receipt.currency],
    };
  }

  const receipts = mapNonEmpty(receiptSplits, resolve);
  const billedCurrencies = [...new Set(receipts.map(({ receipt }) => receipt.currency))];
  // Totals can stay as billed only when every receipt shares one currency.
  const currency =
    !showBaseCurrency && billedCurrencies.length === 1 ? billedCurrencies[0] : BASE_CURRENCY;
  const sharesOneRate =
    billedCurrencies.length === 1 && new Set(receipts.map(({ rate }) => rate)).size === 1;

  return {
    scope: 'all',
    receipts,
    total: {
      split:
        currency === BASE_CURRENCY
          ? consolidated
          : consolidateSplits(receiptSplits, exchangeRates, currency),
      baseSplit: consolidated,
      currency,
      rate: sharesOneRate ? receipts[0].rate : null,
    },
    billedCurrencies,
  };
}

/** The one receipt a receipt tab shows; null on the combined tab. */
export function soleReceipt(view: SummaryView): Receipt | null {
  return view.scope === 'one' ? view.receipts[0].receipt : null;
}

function resolveReceiptView(
  { receipt, split }: ReceiptSplit,
  index: number,
  exchangeRates: Record<string, number>,
  showBaseCurrency: boolean,
): ReceiptView {
  const baseSplit = convertSplitResult(
    split,
    receipt.currency,
    BASE_CURRENCY,
    exchangeRates,
    receipt.exchangeRateOverride,
  );
  return {
    receipt,
    name: receipt.name || `Receipt ${index + 1}`,
    split: showBaseCurrency ? baseSplit : split,
    baseSplit,
    currency: showBaseCurrency ? BASE_CURRENCY : receipt.currency,
    rate:
      receipt.currency === BASE_CURRENCY
        ? null
        : getEffectiveRate(receipt.currency, exchangeRates, receipt.exchangeRateOverride),
  };
}
