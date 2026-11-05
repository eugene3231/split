import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ReconciliationNotice } from '@features/split-workspace/components/shared/ReconciliationNotice';
import { StepHeader } from '@features/split-workspace/components/shared/StepHeader';
import { formatExchangeRate } from '@shared/logic/core/money';
import { getShareSupport } from '@features/split-workspace/summary/shareSplit';
import { PersonBreakdownCard } from '@features/split-workspace/summary/breakdown/PersonBreakdownCard';
import { BASE_CURRENCY } from '@shared/constants';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { SummaryTabs } from './SummaryTabs';
import { CurrencyToggle } from './CurrencyToggle';
import { GrandTotalCard } from './GrandTotalCard';
import { ExportActions, SaveImageButton } from './ExportActions';
import { AddReceiptButton } from '@features/split-workspace/components/shared/ReceiptTabs';
import { ResetSplitAction } from '@features/split-workspace/components/ResetSplitAction';
import { ImagePreviewModal } from './ImagePreviewModal';
import { soleReceipt } from '@features/split-workspace/summary/summaryView';
import { useSummaryModel } from './useSummaryModel';
import { useSummaryExport } from './useSummaryExport';
import { SummaryModeToggle } from './SummaryModeToggle';
import type { SummaryMode } from './SummaryModeToggle';
import { OverviewTable } from '@features/split-workspace/summary/overview/OverviewTable';
import { MixedCurrencyNote } from './MixedCurrencyNote';
import { PersonBreakdownAnchor, PersonTotalsList } from './PersonTotalsList';
import { cn } from '@shared/utils/cn';
import { SummaryDetailToggle } from './SummaryDetailToggle';
import type { SummaryDetail } from '@features/split-workspace/summary/breakdown/types';

export type SummaryStepProps = {
  /** Where the bottom bar takes the step's primary action, Save image. */
  actionSlot?: HTMLDivElement | null;
  onAddReceipt: () => void;
  onResetSplit: () => void;
};

export function SummaryStep({ actionSlot, onAddReceipt, onResetSplit }: SummaryStepProps) {
  const [activeTab, setActiveTab] = useState<string>(() => {
    const receipts = useReceiptStore.getState().receipts;
    return receipts.length > 1 ? 'total' : receipts[0].id;
  });
  const [detail, setDetail] = useState<SummaryDetail>('their-items');
  const [showBaseCurrency, setShowBaseCurrency] = useState(false);
  const [mode, setMode] = useState<SummaryMode>('by-person');

  const model = useSummaryModel({ activeTab, showBaseCurrency, detail });
  const { people, receipts, renameReceipt, view, summaryBreakdown, summaryOverview } = model;
  const patchReceipt = useReceiptStore((state) => state.patchReceipt);
  const { exportState, text, previewUrl, download, preview, share, closePreview } =
    useSummaryExport({ model, mode });

  const receiptForExport = soleReceipt(view);
  const nativeCurrency = receiptForExport?.currency ?? BASE_CURRENCY;
  const showCurrencyControls = view.billedCurrencies.some((currency) => currency !== BASE_CURRENCY);

  const nativeShareSupported = getShareSupport() === 'native';
  const isOverview = mode === 'overview';

  return (
    <div>
      <div className="mb-4 md:mb-8">
        <StepHeader
          title="What everyone owes"
          description="Check the totals, then save or share the split."
          className="mb-4 md:mb-6"
        />

        {receipts.length > 1 && (
          <SummaryTabs
            receipts={receipts}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onRenameReceipt={renameReceipt}
            onAddReceipt={onAddReceipt}
            className="mb-4"
          />
        )}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <SummaryModeToggle mode={mode} onModeChange={setMode} />
          {receipts.length === 1 && (
            <div className="-ml-2 w-full sm:ml-0 sm:w-auto [&>button]:mb-0">
              <AddReceiptButton
                data-testid="summary-add-receipt-btn"
                labelOnPhones
                onClick={onAddReceipt}
              />
            </div>
          )}
        </div>
      </div>

      {/* Only a mismatch is worth a banner here; the receipt step also confirms a match. */}
      {receiptForExport &&
        model.reconciliation.cents !== null &&
        model.reconciliation.cents !== 0 && (
          <div className="mb-4 md:mb-8">
            <ReconciliationNotice
              reconciliation={model.reconciliation}
              currency={receiptForExport.currency}
              onApplyFix={(fix) => patchReceipt(receiptForExport.id, fix)}
            />
          </div>
        )}

      {/* On a phone the total leads and the actions follow the cards. From lg the total and the
          actions share a band above the content, and By person adds an index of the cards beside
          them, while the overview table takes the full width. */}
      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-12 lg:gap-x-8">
        <div className="lg:col-span-8">
          <GrandTotalCard
            payNowStatus={model.payNowStatus}
            totalLabel={summaryBreakdown.totalLabel}
            grandTotal={view.total.split.totals.totalCents}
            displayCurrency={view.total.currency}
            currentReceipt={receiptForExport}
            people={people}
            onRenameReceipt={renameReceipt}
          />
        </div>

        <div className="order-last flex flex-col gap-3 lg:order-none lg:col-span-4 lg:self-center">
          <ExportActions
            exportState={exportState}
            text={text}
            nativeShareSupported={nativeShareSupported}
            onShare={share}
            onPreview={preview}
          />
          <ResetSplitAction onConfirm={onResetSplit} className="self-center" />
        </div>

        <div className={cn('min-w-0', isOverview ? 'lg:col-span-12' : 'lg:col-span-8')}>
          <div
            data-testid="summary-controls"
            className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 empty:hidden"
          >
            {!isOverview && <SummaryDetailToggle detail={detail} onDetailChange={setDetail} />}
            {showCurrencyControls && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:ml-auto">
                <CurrencyToggle
                  showBaseCurrency={showBaseCurrency}
                  onToggle={setShowBaseCurrency}
                  activeTab={activeTab}
                  currentCurrency={nativeCurrency}
                />
                {!receiptForExport && !showBaseCurrency && view.total.currency === BASE_CURRENCY ? (
                  <MixedCurrencyNote currencies={view.billedCurrencies} />
                ) : receiptForExport && view.total.rate ? (
                  <p className="text-xs text-on-surface-variant">
                    1 {BASE_CURRENCY} = {formatExchangeRate(1 / view.total.rate)} {nativeCurrency}
                    {receiptForExport.exchangeRateOverride ? ' (custom rate)' : ''}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {isOverview ? (
            <div key={`overview-${activeTab}`} className="motion-safe:animate-fade-in">
              <OverviewTable overview={summaryOverview} />
            </div>
          ) : (
            <div
              key={`by-person-${activeTab}`}
              className={cn(
                'grid grid-cols-1 gap-4 motion-safe:animate-fade-in md:grid-cols-2',
                detail === 'totals' && 'xl:grid-cols-3',
              )}
            >
              {summaryBreakdown.personBreakdowns.map((breakdown) => (
                <PersonBreakdownAnchor key={breakdown.person.id} personId={breakdown.person.id}>
                  <PersonBreakdownCard breakdown={breakdown} />
                </PersonBreakdownAnchor>
              ))}
            </div>
          )}
        </div>

        {!isOverview && (
          <aside className="hidden lg:sticky lg:top-[calc(var(--app-bar-height)+1.5rem)] lg:col-span-4 lg:block lg:self-start">
            <PersonTotalsList breakdowns={summaryBreakdown.personBreakdowns} />
          </aside>
        )}
      </div>

      {actionSlot &&
        createPortal(
          <SaveImageButton exportState={exportState} onDownload={download} />,
          actionSlot,
        )}
      {previewUrl && <ImagePreviewModal url={previewUrl} onClose={closePreview} />}
    </div>
  );
}
