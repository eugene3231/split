import { useState } from 'react';
import { ReconciliationNotice } from '@features/split-workspace/components/shared/ReconciliationNotice';
import { StepHeader } from '@features/split-workspace/components/shared/StepHeader';
import { formatExchangeRate } from '@shared/logic/core/money';
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
import { soleReceipt } from '@features/split-workspace/logic/summaryView';
import { useSummaryModel } from './useSummaryModel';
import { useSummaryExport } from './useSummaryExport';
import { SummaryModeToggle } from './SummaryModeToggle';
import type { SummaryMode } from './SummaryModeToggle';
import { OverviewTable } from './OverviewTable';
import { MixedCurrencyNote } from './MixedCurrencyNote';
import { cn } from '@shared/utils/cn';
import { SummaryDetailToggle } from './SummaryDetailToggle';
import type { SummaryDetail } from '@shared/types/summaryBreakdown';

export type SummaryStepProps = {
  onAddReceipt: () => void;
  onResetSplit: () => void;
};

export function SummaryStep({ onAddReceipt, onResetSplit }: SummaryStepProps) {
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
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <StepHeader
            title="What everyone owes"
            description="Check the totals, then save or share the split."
            className="mb-6"
          />
          <ResetSplitAction onConfirm={onResetSplit} />
        </div>

        <SummaryTabs
          receipts={receipts}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onRenameReceipt={renameReceipt}
          onAddReceipt={onAddReceipt}
        />

        <div className="mt-4">
          <SummaryModeToggle mode={mode} onModeChange={setMode} />
        </div>
      </div>

      {/* Only a mismatch is worth a banner here; the receipt step also confirms a match. */}
      {receiptForExport &&
        model.reconciliation.cents !== null &&
        model.reconciliation.cents !== 0 && (
          <div className="mb-8">
            <ReconciliationNotice
              reconciliation={model.reconciliation}
              currency={receiptForExport.currency}
              onApplyFix={(fix) => patchReceipt(receiptForExport.id, fix)}
            />
          </div>
        )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className={cn(isOverview ? 'lg:col-span-12' : 'order-2 lg:order-1 lg:col-span-8')}>
          <div
            data-testid="summary-controls"
            className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2"
          >
            {showCurrencyControls && (
              <>
                <CurrencyToggle
                  showBaseCurrency={showBaseCurrency}
                  onToggle={setShowBaseCurrency}
                  activeTab={activeTab}
                  currentCurrency={nativeCurrency}
                />
                {/* On phones the note drops below so both switches share one line. */}
                <div className="order-last w-full sm:order-none sm:w-auto">
                  {!receiptForExport &&
                  !showBaseCurrency &&
                  view.total.currency === BASE_CURRENCY ? (
                    <MixedCurrencyNote currencies={view.billedCurrencies} />
                  ) : receiptForExport && view.total.rate ? (
                    <p className="text-xs text-on-surface-variant">
                      1 {BASE_CURRENCY} = {formatExchangeRate(1 / view.total.rate)} {nativeCurrency}
                      {receiptForExport.exchangeRateOverride ? ' (custom rate)' : ''}
                    </p>
                  ) : null}
                </div>
              </>
            )}
            {!isOverview && (
              <SummaryDetailToggle detail={detail} onDetailChange={setDetail} className="ml-auto" />
            )}
          </div>

          {isOverview ? (
            <div key={`overview-${activeTab}`} className="motion-safe:animate-fade-in">
              <OverviewTable overview={summaryOverview} />
            </div>
          ) : (
            <div
              key={`by-person-${activeTab}`}
              className="flex flex-col gap-6 motion-safe:animate-fade-in"
            >
              {summaryBreakdown.personBreakdowns.map((breakdown) => (
                <PersonBreakdownCard key={breakdown.person.id} breakdown={breakdown} />
              ))}
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
              payNowStatus={model.payNowStatus}
              totalLabel={summaryBreakdown.totalLabel}
              grandTotal={view.total.split.totals.totalCents}
              displayCurrency={view.total.currency}
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
