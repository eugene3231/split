import { useState } from 'react';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { getShareSupport } from '@features/sharing/logic/shareSplit';
import { PersonBreakdownCard } from './PersonBreakdownCard';
import { BASE_CURRENCY } from '@shared/constants';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { SummaryTabs } from './SummaryTabs';
import { CurrencyToggle } from './CurrencyToggle';
import { GrandTotalCard } from './GrandTotalCard';
import { ExportActions } from './ExportActions';
import { ImagePreviewModal } from './ImagePreviewModal';
import { useSummaryModel } from './useSummaryModel';
import { useSummaryExport } from './useSummaryExport';

export type SummaryStepProps = {
  onAddReceipt: () => void;
};

export function SummaryStep({ onAddReceipt }: SummaryStepProps) {
  const [activeTab, setActiveTab] = useState<string>(() => {
    const receipts = useReceiptStore.getState().receipts;
    return receipts.length > 1 ? 'total' : (receipts[0]?.id ?? 'total');
  });
  const [showDetails, setShowDetails] = useState(true);
  const [showBaseCurrency, setShowBaseCurrency] = useState(false);

  const model = useSummaryModel({
    activeTab,
    showBaseCurrency,
  });
  const { people, receipts, isMultiReceipt, renameReceipt, view, summaryBreakdown } = model;
  const reconciliationCents = model.reconciliation.cents;
  const { busy, copied, exportError, previewUrl, download, preview, share, closePreview } =
    useSummaryExport({
      model,
      includeItemDetails: showDetails,
    });

  if (receipts.length === 0) {
    return null;
  }

  // Narrow per-tab fields to avoid repetitive view.kind checks in JSX.
  // Total tab has no single receipt to name — GrandTotalCard falls back to
  // a static "Grand Total" label instead of an editable receipt name.
  const receiptForExport = view.kind === 'receipt' ? view.receipt : null;
  const nativeCurrency = view.kind === 'receipt' ? view.nativeCurrency : BASE_CURRENCY;
  const showCurrencyControls =
    (view.kind === 'receipt' && view.isForeign) || (view.kind === 'total' && view.hasAnyForeign);

  const nativeShareSupported = getShareSupport() === 'native';

  return (
    <div>
      {/* Title + tabs */}
      <div className="mb-8">
        {/* Desktop header */}
        <div className="mb-6 hidden md:block">
          <h1 className="font-headline mb-2 text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">
            Final Breakdown
          </h1>
          <p className="text-lg text-on-surface-variant">
            Review the consolidated grand total or individual receipt details.
          </p>
        </div>

        {/* Mobile header */}
        <div className="mb-4 md:hidden">
          <h1 className="font-headline text-xl font-extrabold tracking-tight text-on-surface">
            Final Breakdown
          </h1>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            Review the consolidated grand total or individual receipt details.
          </p>
        </div>

        {isMultiReceipt && (
          <SummaryTabs
            receipts={receipts}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onRenameReceipt={renameReceipt}
          />
        )}
      </div>

      {/* Discrepancy notice */}
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
                  {formatCurrencyFromCents(Math.abs(reconciliationCents))} off from the receipt
                  total.
                </p>
              </div>
            </div>
            {reconciliationCents < 0 && (
              <button
                type="button"
                onClick={model.reconciliation.applyCorrectiveDiscount}
                className="rounded-xl bg-on-error-container px-6 py-2.5 text-sm font-bold whitespace-nowrap text-on-primary transition-opacity hover:opacity-90"
              >
                Apply Corrective Discount
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main two-column layout */}
      <div className="mb-12 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Person cards */}
        <div className="order-2 lg:order-1 lg:col-span-8">
          <div className="mb-3 flex items-center justify-between">
            {showCurrencyControls ? (
              <div className="flex flex-wrap items-center gap-4">
                <CurrencyToggle
                  showBaseCurrency={showBaseCurrency}
                  onToggle={setShowBaseCurrency}
                  activeTab={activeTab}
                  currentCurrency={nativeCurrency}
                />
                {view.kind === 'total' && view.foreignRates.length > 0 ? (
                  <></>
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
            <button
              type="button"
              data-testid="summary-show-details-btn"
              onClick={() => setShowDetails((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-semibold text-on-surface-variant transition-colors hover:text-primary"
            >
              <span className="material-symbols-outlined text-base">
                {showDetails ? 'expand_less' : 'expand_more'}
              </span>
              {showDetails ? 'Hide details' : 'Show details'}
            </button>
          </div>

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
        </div>

        {/* Right: Grand total + export */}
        <div className="order-1 flex flex-col gap-4 lg:order-2 lg:col-span-4">
          <GrandTotalCard
            grandTotal={view.grandTotal}
            displayCurrency={view.displayCurrency}
            currentReceipt={receiptForExport}
            people={people}
            onRenameReceipt={renameReceipt}
          />
          <ExportActions
            busy={busy}
            copied={copied}
            exportError={exportError}
            nativeShareSupported={nativeShareSupported}
            onDownload={download}
            onShare={share}
            onPreview={preview}
          />
        </div>
      </div>

      {/* Add receipt secondary action */}
      <div className="mb-4 flex justify-center">
        <button
          type="button"
          data-testid="summary-add-receipt-btn"
          onClick={onAddReceipt}
          className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant transition-colors hover:text-primary"
        >
          <span className="material-symbols-outlined text-base">add_box</span>
          Add new receipt
        </button>
      </div>
      {previewUrl && <ImagePreviewModal url={previewUrl} onClose={closePreview} />}
    </div>
  );
}
