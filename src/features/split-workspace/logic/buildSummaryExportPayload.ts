import { normalizeMobile } from '@features/payments';
import type { SummaryModel } from '@features/split-workspace/components/steps/SummaryStep/useSummaryModel';

type BuildSummaryExportPayloadArgs = {
  model: Pick<
    SummaryModel,
    'people' | 'receipts' | 'payerMobile' | 'reconciliation' | 'splitByReceipt' | 'view'
  >;
  includeItemDetails: boolean;
  showBaseCurrency: boolean;
};

export function buildSummaryExportPayload({
  model,
  includeItemDetails,
  showBaseCurrency,
}: BuildSummaryExportPayloadArgs) {
  const { view } = model;

  return {
    people: model.people,
    split: view.displaySplit,
    sgdSplit: view.sgdSplit,
    receipts: model.receipts,
    splitByReceipt: model.splitByReceipt,
    discount: view.discount,
    serviceCharge: view.serviceCharge,
    gst: view.gst,
    receiptName: view.kind === 'receipt' ? view.receipt?.name : undefined,
    reconciliationCents: model.reconciliation.cents,
    includeItemDetails,
    currency: view.displayCurrency,
    payerMobile: normalizeMobile(model.payerMobile) ?? undefined,
    conversionRate:
      view.kind === 'receipt' && view.isForeign && !showBaseCurrency
        ? (view.effectiveRate ?? undefined)
        : undefined,
    fromCurrency:
      view.kind === 'receipt' && view.isForeign && !showBaseCurrency
        ? view.nativeCurrency
        : undefined,
    effectiveRatesByReceipt:
      view.kind === 'total' ? view.receiptBreakdowns.map((b) => b.effectiveRate) : undefined,
  };
}
