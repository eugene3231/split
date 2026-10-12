import type { ChargeState, Person, Receipt, SplitResult } from '@shared/types';
import { BASE_CURRENCY } from '@shared/constants';
import { computeConsolidatedSplit } from '@features/split-workspace/logic/split/split';
import {
  convertSplitResult,
  getEffectiveRate,
} from '@features/split-workspace/logic/exchangeRates';

interface BaseView {
  displaySplit: SplitResult;
  displayCurrency: string;
  grandTotal: number;
  /** Always in SGD — used for QR generation and PayNow amounts. */
  sgdSplit: SplitResult;
}

export interface TotalTabView extends BaseView {
  kind: 'total';
  hasAnyForeign: boolean;
  /** Each currency the receipts were billed in, in receipt order. */
  billedCurrencies: string[];
  /** The one rate every receipt converts at when totals show in a foreign currency, else null. */
  billedRate: number | null;
  /** Per-receipt split data consumed by summaryBreakdown on the consolidated tab. */
  receiptBreakdowns: {
    id: string;
    name: string;
    split: SplitResult;
    sgdSplit: SplitResult;
    currency: string;
    discount: ChargeState;
    serviceCharge: ChargeState;
    gst: ChargeState;
    effectiveRate?: number;
  }[];
}

export interface ReceiptTabView extends BaseView {
  kind: 'receipt';
  receipt: Receipt;
  nativeCurrency: string;
  isForeign: boolean;
  effectiveRate: number | null;
}

export type SummaryView = TotalTabView | ReceiptTabView;

export type ResolveSummaryViewInput = {
  people: Person[];
  receipts: Receipt[];
  splitByReceipt: SplitResult[];
  consolidatedSplit: SplitResult;
  exchangeRates: Record<string, number>;
  /** A receipt id, or anything else (by convention `'total'`) for every receipt combined. */
  activeTab: string;
  showBaseCurrency: boolean;
};

function grandTotalOf(split: SplitResult): number {
  return Object.values(split.totalByPersonCents).reduce((s, v) => s + v, 0);
}

function resolveTotalTab({
  people,
  receipts,
  splitByReceipt,
  consolidatedSplit,
  exchangeRates,
  showBaseCurrency,
}: ResolveSummaryViewInput): TotalTabView {
  const sgdSplitByReceipt = splitByReceipt.map((s, i) => {
    const currency = receipts[i]?.currency ?? BASE_CURRENCY;
    return currency !== BASE_CURRENCY
      ? convertSplitResult(
          s,
          currency,
          BASE_CURRENCY,
          exchangeRates,
          receipts[i]?.exchangeRateOverride ?? null,
        )
      : s;
  });

  const receiptBreakdowns = receipts.map((r, i) => {
    const currency = showBaseCurrency ? BASE_CURRENCY : (r.currency ?? BASE_CURRENCY);
    const isForeign = (r.currency ?? BASE_CURRENCY) !== BASE_CURRENCY;
    return {
      id: r.id,
      name: r.name || `Receipt ${i + 1}`,
      split: (showBaseCurrency ? sgdSplitByReceipt[i] : splitByReceipt[i]) ?? splitByReceipt[i],
      sgdSplit: sgdSplitByReceipt[i],
      currency,
      discount: r.discount,
      serviceCharge: r.serviceCharge,
      gst: r.gst,
      effectiveRate:
        !showBaseCurrency && isForeign
          ? getEffectiveRate(r.currency!, exchangeRates, r.exchangeRateOverride ?? null)
          : undefined,
    };
  });

  const billedCurrencies = [...new Set(receipts.map((r) => r.currency ?? BASE_CURRENCY))];
  // Totals can stay as billed only when every receipt shares one currency.
  const totalCurrency =
    !showBaseCurrency && billedCurrencies.length === 1 ? billedCurrencies[0] : BASE_CURRENCY;
  const displaySplit =
    totalCurrency === BASE_CURRENCY
      ? consolidatedSplit
      : computeConsolidatedSplit(
          splitByReceipt,
          people,
          receipts.map((r) => r.currency),
          exchangeRates,
          receipts.map((r) => r.exchangeRateOverride),
          totalCurrency,
        );
  const receiptRates = receipts.map((r) =>
    getEffectiveRate(totalCurrency, exchangeRates, r.exchangeRateOverride ?? null),
  );

  return {
    kind: 'total',
    displaySplit,
    displayCurrency: totalCurrency,
    grandTotal: grandTotalOf(displaySplit),
    sgdSplit: consolidatedSplit,
    hasAnyForeign: receipts.some((r) => (r.currency ?? BASE_CURRENCY) !== BASE_CURRENCY),
    billedCurrencies,
    billedRate:
      totalCurrency !== BASE_CURRENCY && new Set(receiptRates).size === 1 ? receiptRates[0] : null,
    receiptBreakdowns,
  };
}

function resolveReceiptTab(
  { receipts, splitByReceipt, exchangeRates, showBaseCurrency }: ResolveSummaryViewInput,
  receiptIndex: number,
): ReceiptTabView {
  const receipt = receipts[receiptIndex];
  const nativeSplit = splitByReceipt[receiptIndex];

  const nativeCurrency = receipt.currency ?? BASE_CURRENCY;
  const isForeign = nativeCurrency !== BASE_CURRENCY;

  const sgdSplit = isForeign
    ? convertSplitResult(
        nativeSplit,
        nativeCurrency,
        BASE_CURRENCY,
        exchangeRates,
        receipt.exchangeRateOverride ?? null,
      )
    : nativeSplit;

  const displaySplit = isForeign && showBaseCurrency ? sgdSplit : nativeSplit;
  const displayCurrency = isForeign && showBaseCurrency ? BASE_CURRENCY : nativeCurrency;

  return {
    kind: 'receipt',
    receipt,
    displaySplit,
    displayCurrency,
    grandTotal: grandTotalOf(displaySplit),
    sgdSplit,
    nativeCurrency,
    isForeign,
    effectiveRate: isForeign
      ? getEffectiveRate(nativeCurrency, exchangeRates, receipt.exchangeRateOverride ?? null)
      : null,
  };
}

export function resolveSummaryView(input: ResolveSummaryViewInput): SummaryView {
  const receiptIndex = input.receipts.findIndex((receipt) => receipt.id === input.activeTab);
  return receiptIndex === -1 ? resolveTotalTab(input) : resolveReceiptTab(input, receiptIndex);
}
