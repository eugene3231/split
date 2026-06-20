import type { SummaryModel } from '@features/split-workspace/components/steps/SummaryStep/useSummaryModel';

type BuildSummaryExportPayloadArgs = {
  model: Pick<SummaryModel, 'reconciliation' | 'view' | 'summaryBreakdown'>;
  includeItemDetails: boolean;
};

export function buildSummaryExportPayload({
  model,
  includeItemDetails,
}: BuildSummaryExportPayloadArgs) {
  const { view } = model;

  return {
    summaryBreakdown: model.summaryBreakdown,
    split: view.displaySplit,
    receiptName: view.kind === 'receipt' ? view.receipt?.name : undefined,
    reconciliationCents: model.reconciliation.cents,
    includeItemDetails,
    currency: view.displayCurrency,
  };
}
