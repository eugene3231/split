import { useState } from 'react';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { getShareSupport } from '@features/sharing/logic/shareSplit';
import { PersonRowCompact } from './PersonRowCompact';
import { buildRankedList } from './buildRankedList';
import { BASE_CURRENCY } from '@shared/constants';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { SummaryTabs } from './SummaryTabs';
import { CurrencyToggle } from './CurrencyToggle';
import { GrandTotalCard } from './GrandTotalCard';
import { ExportActions } from './ExportActions';
import { ImagePreviewModal } from './ImagePreviewModal';
import { PersonPaymentCard } from './PersonPaymentCard';
import { PayNowQrSheet } from './PayNowQrSheet';
import { useSummaryModel } from './useSummaryModel';
import { useSummaryExport } from './useSummaryExport';

const LARGE_GROUP_THRESHOLD = 7;

function getUniqueItemCount(split: { lineItemsByPerson: Record<string, { itemId: string }[]> }) {
  return new Set(
    Object.values(split.lineItemsByPerson).flatMap((lines) => lines.map((line) => line.itemId)),
  ).size;
}

export type SummaryStepProps = {
  onAddReceipt: () => void;
};

export function SummaryStep({ onAddReceipt }: SummaryStepProps) {
  const [activeTab, setActiveTab] = useState<string>(() => {
    const receipts = useReceiptStore.getState().receipts;
    return receipts.length > 1 ? 'total' : (receipts[0]?.id ?? 'total');
  });
  const [showBaseCurrency, setShowBaseCurrency] = useState(false);
  const [summarySearch, setSummarySearch] = useState('');
  const [sortDescending, setSortDescending] = useState(true);
  const [expandedPersonId, setExpandedPersonId] = useState<string | null | undefined>(undefined);
  const [payNowPersonId, setPayNowPersonId] = useState<string | null>(null);
  const setPayerMobile = useReceiptStore((s) => s.setPayerMobile);

  const model = useSummaryModel({
    activeTab,
    showBaseCurrency,
  });
  const { people, receipts, activeSummaryReceipt, renameReceipt, view, qrDataUrls, payerMobile } =
    model;
  const reconciliationCents = model.reconciliation.cents;
  const { busy, copied, exportError, previewUrl, download, preview, share, closePreview } =
    useSummaryExport({
      model,
      includeItemDetails: true,
      showBaseCurrency,
    });

  const defaultExpandedPersonId =
    people.length > 0 && people.length < LARGE_GROUP_THRESHOLD
      ? (people.find((person) => (view.displaySplit.totalByPersonCents[person.id] ?? 0) > 0)?.id ??
        people[0]?.id ??
        null)
      : null;
  const hasChosenExpandedPerson =
    expandedPersonId === null ||
    (expandedPersonId !== undefined && people.some((person) => person.id === expandedPersonId));
  const effectiveExpandedPersonId = hasChosenExpandedPerson
    ? expandedPersonId
    : defaultExpandedPersonId;

  const payNowPerson = payNowPersonId
    ? people.find((person) => person.id === payNowPersonId)
    : null;
  const payNowColorIndex = payNowPerson
    ? people.findIndex((person) => person.id === payNowPerson.id)
    : -1;

  if (receipts.length === 0) {
    return null;
  }

  // Narrow per-tab fields to avoid repetitive view.kind checks in JSX
  const receiptForExport = view.kind === 'receipt' ? view.receipt : activeSummaryReceipt;
  const nativeCurrency = view.kind === 'receipt' ? view.nativeCurrency : BASE_CURRENCY;
  const showCurrencyControls =
    (view.kind === 'receipt' && view.isForeign) || (view.kind === 'total' && view.hasAnyForeign);

  const nativeShareSupported = getShareSupport() === 'native';
  const exchangeRateText =
    view.kind === 'receipt' && view.effectiveRate
      ? `1 ${BASE_CURRENCY} = ${parseFloat((1 / view.effectiveRate).toFixed(5))} ${
          view.nativeCurrency
        }${view.receipt?.exchangeRateOverride ? ' (custom rate)' : ''}`
      : null;
  const itemCount = getUniqueItemCount(view.displaySplit);
  const itemCountLabel = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;

  return (
    <div className="relative">
      {/* Receipt context + title */}
      <div className="mb-4">
        <SummaryTabs
          receipts={receipts}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onRenameReceipt={renameReceipt}
          onAddReceipt={onAddReceipt}
        />

        <div className="mt-4 flex items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1 font-display text-4xl leading-[0.95] font-medium tracking-tight text-ink sm:text-5xl">
            The bill, <span className="font-display italic">divided.</span>
          </h1>
          {showCurrencyControls && (
            <CurrencyToggle
              showBaseCurrency={showBaseCurrency}
              onToggle={setShowBaseCurrency}
              activeTab={activeTab}
              currentCurrency={nativeCurrency}
            />
          )}
        </div>
      </div>

      {/* Discrepancy notice */}
      {reconciliationCents !== null && reconciliationCents !== 0 && (
        <div className="mb-6 flex flex-col items-start justify-between gap-3 rounded-[20px] bg-accent-red/10 p-5 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent-red text-ink">
              <span
                className="material-symbols-outlined text-sm"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                warning
              </span>
            </div>
            <div>
              <p className="font-semibold text-ink">Reconciliation mismatch</p>
              <p className="text-sm text-ink2">
                {formatCurrencyFromCents(Math.abs(reconciliationCents))} off from the receipt total.
              </p>
            </div>
          </div>
          {reconciliationCents < 0 && (
            <button
              type="button"
              onClick={model.reconciliation.applyCorrectiveDiscount}
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold whitespace-nowrap text-white transition-opacity hover:opacity-90"
            >
              Apply Corrective Discount
            </button>
          )}
        </div>
      )}

      {/* Main layout — stacked on mobile, two-column on desktop */}
      <div className="mb-12 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Right column first on mobile (hero card) */}
        <div className="order-1 flex flex-col gap-4 lg:order-2 lg:col-span-4">
          <GrandTotalCard
            grandTotal={view.grandTotal}
            displayCurrency={view.displayCurrency}
            currentReceipt={view.kind === 'receipt' ? receiptForExport : null}
            people={people}
            onRenameReceipt={renameReceipt}
            split={view.displaySplit}
            exchangeRateText={exchangeRateText}
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

        {/* Person list */}
        <div className="order-2 lg:order-1 lg:col-span-8">
          <div
            data-testid="summary-per-person-header"
            className="mb-3 text-xs font-semibold tracking-[0.28em] text-ink2 uppercase"
          >
            Per person · {itemCountLabel}
          </div>
          {(() => {
            const isLargeGroup = people.length >= LARGE_GROUP_THRESHOLD;

            if (isLargeGroup) {
              const ranked = buildRankedList(people, view.displaySplit);
              const maxCents = ranked[0]?.totalCents ?? 0;
              const filtered = summarySearch
                ? ranked.filter((r) =>
                    r.person.name.toLowerCase().includes(summarySearch.toLowerCase()),
                  )
                : ranked;
              const displayed = sortDescending ? filtered : [...filtered].reverse();

              return (
                <>
                  {/* Search + sort controls */}
                  <div className="mb-3 flex gap-2">
                    <div className="flex flex-1 items-center gap-2 rounded-[14px] bg-cream px-3 py-2.5">
                      <span className="material-symbols-outlined text-sm text-ink2">search</span>
                      <input
                        type="text"
                        placeholder="Find someone…"
                        value={summarySearch}
                        onChange={(e) => setSummarySearch(e.target.value)}
                        className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink2/60"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setSortDescending((v) => !v)}
                      className="flex items-center gap-1.5 rounded-[14px] bg-cream px-3 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-cream-dim"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {sortDescending ? 'arrow_downward' : 'arrow_upward'}
                      </span>
                      {sortDescending ? 'High → low' : 'Low → high'}
                    </button>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {displayed.length > 0 ? (
                      displayed.map(({ person, originalIndex, totalCents }, i) => (
                        <PersonRowCompact
                          key={person.id}
                          rank={sortDescending ? i + 1 : ranked.length - i}
                          person={person}
                          colorIndex={originalIndex}
                          totalCents={totalCents}
                          maxCents={maxCents}
                          currency={view.displayCurrency}
                        />
                      ))
                    ) : (
                      <p className="py-6 text-center text-sm text-ink2">
                        No match for "{summarySearch}"
                      </p>
                    )}
                  </div>
                </>
              );
            }

            return (
              <>
                <div className="flex flex-col gap-3">
                  {people.map((person, index) => (
                    <PersonPaymentCard
                      key={person.id}
                      person={person}
                      colorIndex={index}
                      split={view.displaySplit}
                      discount={view.discount}
                      serviceCharge={view.serviceCharge}
                      gst={view.gst}
                      expanded={effectiveExpandedPersonId === person.id}
                      currency={view.displayCurrency}
                      receiptBreakdown={view.kind === 'total' ? view.receiptBreakdowns : undefined}
                      onToggle={() =>
                        setExpandedPersonId(
                          effectiveExpandedPersonId === person.id ? null : person.id,
                        )
                      }
                      onShowPayNow={() => setPayNowPersonId(person.id)}
                    />
                  ))}
                  {people.length === 0 && (
                    <p className="py-8 text-center text-sm text-ink2">
                      Add people to see the breakdown.
                    </p>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {previewUrl && <ImagePreviewModal url={previewUrl} onClose={closePreview} />}
      {payNowPerson && payNowColorIndex >= 0 && (
        <PayNowQrSheet
          person={payNowPerson}
          colorIndex={payNowColorIndex}
          totalCents={view.displaySplit.totalByPersonCents[payNowPerson.id] ?? 0}
          currency={view.displayCurrency}
          payerMobile={payerMobile}
          qrDataUrl={qrDataUrls[payNowPerson.id]}
          onPayerMobileChange={setPayerMobile}
          onClose={() => setPayNowPersonId(null)}
        />
      )}
    </div>
  );
}
