import type { Receipt, ReceiptSplit, SplitResult } from '@shared/types';
import { BASE_CURRENCY, type CurrencyCode } from '@shared/constants';
import { consolidateSplits } from '@features/split-workspace/logic/split/split';
import {
  convertSplitResult,
  getEffectiveRate,
} from '@features/split-workspace/logic/exchangeRates';
import type { NonEmptyArray } from '@features/split-workspace/logic/nonEmpty';

interface BaseView {
  displaySplit: SplitResult;
  displayCurrency: CurrencyCode;
  /** Always in the base currency — used for QR generation and PayNow amounts. */
  baseSplit: SplitResult;
}

export interface TotalTabView extends BaseView {
  kind: 'total';
  hasAnyForeign: boolean;
  /** Each currency the receipts were billed in, in receipt order. */
  billedCurrencies: CurrencyCode[];
  /** The one rate every receipt converts at when totals show in a foreign currency, else null. */
  billedRate: number | null;
  /** Per-receipt split data consumed by summaryBreakdown on the consolidated tab. */
  receiptBreakdowns: {
    receipt: Receipt;
    name: string;
    split: SplitResult;
    baseSplit: SplitResult;
    currency: CurrencyCode;
    effectiveRate?: number;
  }[];
}

export interface ReceiptTabView extends BaseView {
  kind: 'receipt';
  receipt: Receipt;
  nativeCurrency: CurrencyCode;
  isForeign: boolean;
  effectiveRate: number | null;
}

export type SummaryView = TotalTabView | ReceiptTabView;

export interface ResolveSummaryViewInput {
  receiptSplits: NonEmptyArray<ReceiptSplit>;
  /** Every receipt added up in the base currency. */
  consolidated: SplitResult;
  exchangeRates: Record<string, number>;
  /** A receipt id, or anything else (by convention `'total'`) for every receipt combined. */
  activeTab: string;
  showBaseCurrency: boolean;
}

function toBaseCurrency(
  { receipt, split }: ReceiptSplit,
  exchangeRates: Record<string, number>,
): SplitResult {
  return convertSplitResult(
    split,
    receipt.currency,
    BASE_CURRENCY,
    exchangeRates,
    receipt.exchangeRateOverride,
  );
}

function resolveTotalTab({
  receiptSplits,
  consolidated,
  exchangeRates,
  showBaseCurrency,
}: ResolveSummaryViewInput): TotalTabView {
  const receipts = receiptSplits.map(({ receipt }) => receipt);

  const receiptBreakdowns = receiptSplits.map((receiptSplit, index) => {
    const { receipt, split } = receiptSplit;
    const baseSplit = toBaseCurrency(receiptSplit, exchangeRates);
    const isForeign = receipt.currency !== BASE_CURRENCY;
    return {
      receipt,
      name: receipt.name || `Receipt ${index + 1}`,
      split: showBaseCurrency ? baseSplit : split,
      baseSplit,
      currency: showBaseCurrency ? BASE_CURRENCY : receipt.currency,
      effectiveRate:
        !showBaseCurrency && isForeign
          ? getEffectiveRate(receipt.currency, exchangeRates, receipt.exchangeRateOverride)
          : undefined,
    };
  });

  const billedCurrencies = [...new Set(receipts.map((receipt) => receipt.currency))];
  // Totals can stay as billed only when every receipt shares one currency.
  const totalCurrency =
    !showBaseCurrency && billedCurrencies.length === 1 ? billedCurrencies[0] : BASE_CURRENCY;
  const receiptRates = receipts.map((receipt) =>
    getEffectiveRate(totalCurrency, exchangeRates, receipt.exchangeRateOverride),
  );

  return {
    kind: 'total',
    displaySplit:
      totalCurrency === BASE_CURRENCY
        ? consolidated
        : consolidateSplits(receiptSplits, exchangeRates, totalCurrency),
    displayCurrency: totalCurrency,
    baseSplit: consolidated,
    hasAnyForeign: receipts.some((receipt) => receipt.currency !== BASE_CURRENCY),
    billedCurrencies,
    billedRate:
      totalCurrency !== BASE_CURRENCY && new Set(receiptRates).size === 1 ? receiptRates[0] : null,
    receiptBreakdowns,
  };
}

function resolveReceiptTab(
  receiptSplit: ReceiptSplit,
  { exchangeRates, showBaseCurrency }: ResolveSummaryViewInput,
): ReceiptTabView {
  const { receipt, split } = receiptSplit;
  const isForeign = receipt.currency !== BASE_CURRENCY;
  const baseSplit = toBaseCurrency(receiptSplit, exchangeRates);
  const showsBase = isForeign && showBaseCurrency;

  return {
    kind: 'receipt',
    receipt,
    displaySplit: showsBase ? baseSplit : split,
    displayCurrency: showsBase ? BASE_CURRENCY : receipt.currency,
    baseSplit,
    nativeCurrency: receipt.currency,
    isForeign,
    effectiveRate: isForeign
      ? getEffectiveRate(receipt.currency, exchangeRates, receipt.exchangeRateOverride)
      : null,
  };
}

export function resolveSummaryView(input: ResolveSummaryViewInput): SummaryView {
  const receiptSplit = input.receiptSplits.find(({ receipt }) => receipt.id === input.activeTab);
  return receiptSplit ? resolveReceiptTab(receiptSplit, input) : resolveTotalTab(input);
}
