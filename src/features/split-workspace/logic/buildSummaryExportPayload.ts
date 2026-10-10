import type { SummaryBreakdown } from '@shared/types/summaryBreakdown';
import type { SummaryView } from './summaryView';

interface BuildSummaryExportPayloadArgs {
  model: {
    reconciliation: { cents: number | null };
    view: SummaryView;
    summaryBreakdown: SummaryBreakdown;
  };
  includeItemDetails: boolean;
}

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
