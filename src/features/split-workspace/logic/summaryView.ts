import type { ChargeState, Receipt, SplitResult } from '@shared/types';
import { BASE_CURRENCY } from '@shared/constants';
import {
  convertSplitResult,
  getEffectiveRate,
  getForeignReceiptRates,
} from '@shared/logic/core/exchangeRates';
import type { ForeignCurrencyRate } from '@shared/logic/core/exchangeRates';

export type { ForeignCurrencyRate };

interface BaseView {
  displaySplit: SplitResult;
  displayCurrency: string;
  grandTotal: number;
  discount: ChargeState;
  serviceCharge: ChargeState;
  gst: ChargeState;
  /** Always in SGD — used for QR generation and PayNow amounts. */
  sgdSplit: SplitResult;
}

export interface TotalTabView extends BaseView {
  kind: 'total';
  hasAnyForeign: boolean;
  foreignRates: ForeignCurrencyRate[];
  /** Per-receipt breakdown shown inside each PersonCard on the consolidated tab. */
  receiptBreakdowns: {
    name: string;
    split: SplitResult;
    currency: string;
    discount: ChargeState;
    serviceCharge: ChargeState;
    gst: ChargeState;
    effectiveRate?: number;
  }[];
}

export interface ReceiptTabView extends BaseView {
  kind: 'receipt';
  receipt: Receipt | null;
  nativeCurrency: string;
  isForeign: boolean;
  effectiveRate: number | null;
}

export type SummaryView = TotalTabView | ReceiptTabView;

export type ResolveSummaryViewInput = {
  receipts: Receipt[];
  splitByReceipt: SplitResult[];
  consolidatedSplit: SplitResult;
  /** Fallback split used when activeTab doesn't match any receipt id. */
  fallbackSplit: SplitResult;
  discount: ChargeState;
  serviceCharge: ChargeState;
  gst: ChargeState;
  exchangeRates: Record<string, number>;
  activeTab: string;
  showBaseCurrency: boolean;
};

function grandTotalOf(split: SplitResult): number {
  return Object.values(split.totalByPersonCents).reduce((s, v) => s + v, 0);
}

function resolveTotalTab({
  receipts,
  splitByReceipt,
  consolidatedSplit,
  discount,
  serviceCharge,
  gst,
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
      name: r.name || `Receipt ${i + 1}`,
      split: (showBaseCurrency ? sgdSplitByReceipt[i] : splitByReceipt[i]) ?? splitByReceipt[i],
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

  return {
    kind: 'total',
    displaySplit: consolidatedSplit,
    displayCurrency: BASE_CURRENCY,
    grandTotal: grandTotalOf(consolidatedSplit),
    discount,
    serviceCharge,
    gst,
    sgdSplit: consolidatedSplit,
    hasAnyForeign: receipts.some((r) => (r.currency ?? BASE_CURRENCY) !== BASE_CURRENCY),
    foreignRates: getForeignReceiptRates(receipts, exchangeRates),
    receiptBreakdowns,
  };
}

function resolveReceiptTab({
  receipts,
  splitByReceipt,
  fallbackSplit,
  discount,
  serviceCharge,
  gst,
  exchangeRates,
  activeTab,
  showBaseCurrency,
}: ResolveSummaryViewInput): ReceiptTabView {
  const receiptIndex = receipts.findIndex((r) => r.id === activeTab);
  const receipt = receipts[receiptIndex] ?? null;
  const nativeSplit = splitByReceipt[receiptIndex] ?? fallbackSplit;

  const nativeCurrency = receipt?.currency ?? BASE_CURRENCY;
  const isForeign = nativeCurrency !== BASE_CURRENCY;

  const sgdSplit = isForeign
    ? convertSplitResult(
        nativeSplit,
        nativeCurrency,
        BASE_CURRENCY,
        exchangeRates,
        receipt?.exchangeRateOverride ?? null,
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
    discount: receipt?.discount ?? discount,
    serviceCharge: receipt?.serviceCharge ?? serviceCharge,
    gst: receipt?.gst ?? gst,
    sgdSplit,
    nativeCurrency,
    isForeign,
    effectiveRate: isForeign
      ? getEffectiveRate(nativeCurrency, exchangeRates, receipt?.exchangeRateOverride ?? null)
      : null,
  };
}

export function resolveSummaryView(input: ResolveSummaryViewInput): SummaryView {
  return input.activeTab === 'total' ? resolveTotalTab(input) : resolveReceiptTab(input);
}
