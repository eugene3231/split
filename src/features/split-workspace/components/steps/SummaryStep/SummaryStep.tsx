import { useState } from 'react';
import { StepHeader } from '@features/split-workspace/components/shared/StepHeader';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { getShareSupport } from '@features/sharing/logic/shareSplit';
import { PersonBreakdownCard } from './PersonBreakdownCard';
import { BASE_CURRENCY } from '@shared/constants';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { SummaryTabs } from './SummaryTabs';
import { CurrencyToggle } from './CurrencyToggle';
import { GrandTotalCard } from './GrandTotalCard';
import { ExportActions } from './ExportActions';
import { ResetSplitAction } from '@features/split-workspace/components/ResetSplitAction';
import { ImagePreviewModal } from './ImagePreviewModal';
import { useSummaryModel } from './useSummaryModel';
import { useSummaryExport } from './useSummaryExport';
import { SummaryModeToggle } from './SummaryModeToggle';
import type { SummaryMode } from './SummaryModeToggle';
import { OverviewTable } from './OverviewTable';
import { MixedCurrencyNote } from './MixedCurrencyNote';
import { cn } from '@shared/utils/cn';
import { SummaryTextToggle } from './SummaryTextToggle';

export type SummaryStepProps = {
  onAddReceipt: () => void;
  onResetSplit: () => void;
};

export function SummaryStep({ onAddReceipt, onResetSplit }: SummaryStepProps) {
  const [activeTab, setActiveTab] = useState<string>(() => {
    const receipts = useReceiptStore.getState().receipts;
    return receipts.length > 1 ? 'total' : (receipts[0]?.id ?? 'total');
  });
  const [showDetails, setShowDetails] = useState(true);
  const [showAllItems, setShowAllItems] = useState(false);
  const [showBaseCurrency, setShowBaseCurrency] = useState(false);
  const [mode, setMode] = useState<SummaryMode>('by-person');

  const model = useSummaryModel({
    activeTab,
    showBaseCurrency,
    showAllItems,
  });
  const { people, receipts, renameReceipt, view, summaryBreakdown, summaryOverview } = model;
  const reconciliationCents = model.reconciliation.cents;
  const { exportState, text, previewUrl, download, preview, share, closePreview } =
    useSummaryExport({
      model,
      includeItemDetails: showDetails,
      mode,
    });

  if (receipts.length === 0) {
    return null;
  }

  const receiptForExport = view.kind === 'receipt' ? view.receipt : null;
  const nativeCurrency = view.kind === 'receipt' ? view.nativeCurrency : BASE_CURRENCY;
  const showCurrencyControls =
    (view.kind === 'receipt' && view.isForeign) || (view.kind === 'total' && view.hasAnyForeign);

  const nativeShareSupported = getShareSupport() === 'native';
  const isOverview = mode === 'overview';

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <StepHeader
            title="Final Breakdown"
            description="What everyone owes, by receipt."
            className="mb-6"
          />
          <ResetSplitAction onConfirm={onResetSplit} />
        </div>

        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <SummaryTabs
              receipts={receipts}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onRenameReceipt={renameReceipt}
            />
          </div>
          <button
            type="button"
            data-testid="summary-add-receipt-btn"
            aria-label="Add receipt"
            onClick={onAddReceipt}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-dashed border-outline-variant px-3 py-2.5 font-semibold text-on-surface-variant transition-colors hover:border-primary hover:text-primary md:px-5"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-lg">
              add
            </span>
            <span aria-hidden="true" className="hidden md:inline">
              Add receipt
            </span>
          </button>
        </div>

        <div className="mt-4">
          <SummaryModeToggle mode={mode} onModeChange={setMode} />
        </div>
      </div>

      {reconciliationCents !== null && reconciliationCents !== 0 && (
        <div className="mb-8">
          <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-error/20 bg-error-container/30 p-6 md:flex-row">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-error-container text-on-error-container">
                <span
                  className="material-symbols-outlined"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  warning
                </span>
              </div>
              <div>
                <h4 className="font-bold text-on-error-container">Reconciliation Discrepancy</h4>
                <p className="text-sm text-on-error-container opacity-80">
                  The sum of individual shares is{' '}
                  {formatCurrencyFromCents(Math.abs(reconciliationCents), nativeCurrency)} off from
                  the receipt total.
                </p>
              </div>
            </div>
            {reconciliationCents < 0 ? (
              <button
                type="button"
                onClick={model.reconciliation.applyCorrectiveDiscount}
                className="rounded-xl bg-on-error-container px-6 py-2.5 text-sm font-bold whitespace-nowrap text-on-primary transition-opacity hover:opacity-90"
              >
                Apply Corrective Discount
              </button>
            ) : (
              <button
                type="button"
                data-testid="summary-add-rounding-btn"
                onClick={model.reconciliation.addRounding}
                className="rounded-xl bg-on-error-container px-6 py-2.5 text-sm font-bold whitespace-nowrap text-on-primary transition-opacity hover:opacity-90"
              >
                Add {formatCurrencyFromCents(reconciliationCents, nativeCurrency)} as rounding
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className={cn(isOverview ? 'lg:col-span-12' : 'order-2 lg:order-1 lg:col-span-8')}>
          <div className="mb-3 flex items-center justify-between">
            {showCurrencyControls ? (
              <div className="flex flex-wrap items-center gap-4">
                <CurrencyToggle
                  showBaseCurrency={showBaseCurrency}
                  onToggle={setShowBaseCurrency}
                  activeTab={activeTab}
                  currentCurrency={nativeCurrency}
                />
                {view.kind === 'total' &&
                !showBaseCurrency &&
                view.displayCurrency === BASE_CURRENCY ? (
                  <MixedCurrencyNote currencies={view.billedCurrencies} />
                ) : view.kind === 'receipt' && view.effectiveRate ? (
                  <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                    <span className="material-symbols-outlined text-sm">currency_exchange</span>
                    <span>
                      1 {BASE_CURRENCY} = {parseFloat((1 / view.effectiveRate).toFixed(5))}{' '}
                      {view.nativeCurrency}
                      {view.receipt?.exchangeRateOverride ? ' (custom rate)' : ''}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : (
              <span />
            )}
            {!isOverview && (
              <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
                {showDetails && (
                  <SummaryTextToggle
                    data-testid="summary-show-all-items-btn"
                    icon={showAllItems ? 'visibility_off' : 'visibility'}
                    onClick={() => setShowAllItems((v) => !v)}
                  >
                    {showAllItems ? 'Only their items' : 'Show all items'}
                  </SummaryTextToggle>
                )}
                <SummaryTextToggle
                  data-testid="summary-show-details-btn"
                  icon={showDetails ? 'expand_less' : 'expand_more'}
                  onClick={() => setShowDetails((v) => !v)}
                >
                  {showDetails ? 'Hide details' : 'Show details'}
                </SummaryTextToggle>
              </div>
            )}
          </div>

          {isOverview ? (
            <OverviewTable overview={summaryOverview} />
          ) : (
            <div className="flex flex-col gap-6">
              {summaryBreakdown.personBreakdowns.map((breakdown) => (
                <PersonBreakdownCard
                  key={breakdown.person.id}
                  breakdown={breakdown}
                  showDetails={showDetails}
                />
              ))}
              {summaryBreakdown.emptyPeopleMessage && (
                <p className="py-8 text-center text-sm text-on-surface-variant">
                  {summaryBreakdown.emptyPeopleMessage}
                </p>
              )}
            </div>
          )}
        </div>

        <div
          className={cn(
            'flex flex-col gap-4 lg:col-span-4',
            // Overview gives the table the full width, so the buttons follow it.
            isOverview ? 'lg:col-start-9' : 'order-1 lg:order-2',
          )}
        >
          {/* The overview's Owes row already gives the total, and PayNow only feeds the cards' QR codes. */}
          {!isOverview && (
            <GrandTotalCard
              grandTotal={view.grandTotal}
              displayCurrency={view.displayCurrency}
              currentReceipt={receiptForExport}
              people={people}
              onRenameReceipt={renameReceipt}
            />
          )}
          <ExportActions
            exportState={exportState}
            text={text}
            nativeShareSupported={nativeShareSupported}
            onDownload={download}
            onShare={share}
            onPreview={preview}
          />
        </div>
      </div>

      {previewUrl && <ImagePreviewModal url={previewUrl} onClose={closePreview} />}
    </div>
  );
}
