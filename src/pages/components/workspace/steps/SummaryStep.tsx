import { useEffect, useRef, useState } from 'react';
import type { ChargeState, Person, Receipt, SplitResult } from '@shared/types';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { generateReceiptSplitImageLight } from '@features/split-results/logic/receiptSplitImageLight';
import {
  buildSplitShareText,
  downloadImage,
  getShareSupport,
  shareText,
} from '@features/split-results/logic/shareSplit';
import { PersonCard } from '@pages/components/workspace/shared/PersonCard';
import { BASE_CURRENCY } from '@shared/constants';
import { convertSplitResult } from '@shared/logic/core/exchangeRates';
import { useReceiptStore } from '@shared/stores/receiptStore';
import { useCurrencyStore } from '@shared/stores/currencyStore';
import { normalizeMobile } from '@shared/logic/core/paynow';
import { generatePaynowQrDataUrls } from '@shared/logic/core/paynowQr';
import { SummaryTabs } from './SummaryTabs';
import { CurrencyToggle } from './CurrencyToggle';
import { GrandTotalCard } from './GrandTotalCard';
import { ExportActions } from './ExportActions';

type Props = {
  people: Person[];
  receipts: Receipt[];
  activeReceiptId: string;
  split: SplitResult;
  consolidatedSplit: SplitResult;
  splitByReceipt: SplitResult[];
  discount: ChargeState;
  serviceCharge: ChargeState;
  gst: ChargeState;
  reconciliationCents: number | null;
  onApplyDiscount: () => void;
  onAddReceipt: () => void;
  onRenameReceipt: (id: string, name: string) => void;
};

type ExportBusy = 'downloading' | 'copying' | null;

export function SummaryStep({
  people,
  receipts,
  split,
  consolidatedSplit,
  splitByReceipt,
  discount,
  serviceCharge,
  gst,
  reconciliationCents,
  onApplyDiscount,
  onAddReceipt,
  onRenameReceipt,
}: Props) {
  const isMultiReceipt = receipts.length > 1;
  const [activeTab, setActiveTab] = useState<string>(
    isMultiReceipt ? 'total' : (receipts[0]?.id ?? 'total'),
  );
  const [busy, setBusy] = useState<ExportBusy>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showBaseCurrency, setShowBaseCurrency] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});
  const copyTimeoutRef = useRef<number | null>(null);

  const payerMobile = useReceiptStore((s) => s.payerMobile);

  const activeReceiptIndex = receipts.findIndex((r) => r.id === activeTab);
  const currentSplit =
    activeTab === 'total' ? consolidatedSplit : (splitByReceipt[activeReceiptIndex] ?? split);
  const currentReceipt = activeTab === 'total' ? null : receipts[activeReceiptIndex];
  const currentDiscount = currentReceipt?.discount ?? discount;
  const currentServiceCharge = currentReceipt?.serviceCharge ?? serviceCharge;
  const currentGst = currentReceipt?.gst ?? gst;

  // Consolidated tab shows SGD; individual receipt tabs show the receipt's native currency
  const currentCurrency =
    activeTab === 'total' ? BASE_CURRENCY : (currentReceipt?.currency ?? BASE_CURRENCY);
  const isForeignCurrency = currentCurrency !== BASE_CURRENCY;
  const exchangeRates = useCurrencyStore((s) => s.exchangeRates);
  const convertedSplit = isForeignCurrency
    ? convertSplitResult(
        currentSplit,
        currentCurrency,
        BASE_CURRENCY,
        exchangeRates,
        currentReceipt?.exchangeRateOverride ?? null,
      )
    : null;
  const displaySplit = isForeignCurrency && showBaseCurrency ? convertedSplit! : currentSplit;
  const displayCurrency = isForeignCurrency && showBaseCurrency ? BASE_CURRENCY : currentCurrency;

  const hasAnyForeignReceipt = receipts.some(
    (r) => (r.currency ?? BASE_CURRENCY) !== BASE_CURRENCY,
  );
  const convertedSplitByReceipt = splitByReceipt.map((s, i) => {
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

  const grandTotal = Object.values(displaySplit.totalByPersonCents).reduce((s, v) => s + v, 0);

  const nativeShareSupported = getShareSupport() === 'native';

  // The split used for QR amounts is always in SGD regardless of display currency.
  const sgdSplitForQr = isForeignCurrency ? (convertedSplit ?? currentSplit) : currentSplit;

  // Stable key that changes whenever the per-person SGD amounts change (e.g. on tab switch).
  const qrAmountsKey = people
    .map((p) => `${p.id}:${sgdSplitForQr.totalByPersonCents[p.id] ?? 0}`)
    .join(',');

  useEffect(() => {
    let cancelled = false;
    generatePaynowQrDataUrls(people, sgdSplitForQr, payerMobile).then((urls) => {
      if (!cancelled) setQrDataUrls(urls);
    });
    return () => {
      cancelled = true;
    };
    // qrAmountsKey encodes every person's SGD amount, so it covers `people` and
    // `sgdSplitForQr` transitively — no need to list them directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payerMobile, qrAmountsKey]);

  const handleDownload = async () => {
    setBusy('downloading');
    setExportError(null);
    try {
      const blob = await generateReceiptSplitImageLight({
        people,
        split: displaySplit,
        sgdSplit: sgdSplitForQr,
        receipts,
        splitByReceipt,
        discount: currentDiscount,
        serviceCharge: currentServiceCharge,
        gst: currentGst,
        receiptName: currentReceipt?.name,
        reconciliationCents,
        includeItemDetails: showDetails,
        currency: displayCurrency,
        payerMobile: normalizeMobile(payerMobile) ?? undefined,
      });
      downloadImage(blob, 'split-result.png');
    } catch {
      setExportError('Failed to generate image.');
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async () => {
    setBusy('copying');
    const text = buildSplitShareText({
      people,
      receiptName: currentReceipt?.name ?? '',
      split: displaySplit,
      currency: displayCurrency,
    });
    try {
      await shareText(text);
      setBusy(null);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setBusy(null);
        return;
      }
      setBusy(null);
    }
  };

  return (
    <div>
      {/* Title + tabs */}
      <div className="mb-8">
        {/* Desktop header */}
        <div className="mb-6 hidden md:block">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-on-surface mb-2 font-headline">
            Final Breakdown
          </h1>
          <p className="text-on-surface-variant text-lg">
            Review the consolidated total or individual receipt details.
          </p>
        </div>

        {/* Mobile header */}
        <div className="mb-4 md:hidden">
          <h1 className="text-xl font-extrabold font-headline text-on-surface tracking-tight">
            Final Breakdown
          </h1>
          <p className="text-on-surface-variant text-xs mt-0.5">
            Review the consolidated total or individual receipt details.
          </p>
        </div>

        {isMultiReceipt && (
          <SummaryTabs
            receipts={receipts}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onRenameReceipt={onRenameReceipt}
          />
        )}
      </div>

      {/* Discrepancy notice */}
      {reconciliationCents !== null && reconciliationCents !== 0 && (
        <div className="mb-8">
          <div className="bg-error-container/30 border border-error/20 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-error-container flex items-center justify-center text-on-error-container flex-shrink-0">
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
                onClick={onApplyDiscount}
                className="whitespace-nowrap bg-on-error-container text-on-primary px-6 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
              >
                Apply Corrective Discount
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
        {/* Left: Person cards (single column) */}
        <div className="lg:col-span-8 order-2 lg:order-1">
          <div className="flex items-center justify-between mb-3">
            {isForeignCurrency || (activeTab === 'total' && hasAnyForeignReceipt) ? (
              <CurrencyToggle
                showBaseCurrency={showBaseCurrency}
                onToggle={setShowBaseCurrency}
                activeTab={activeTab}
                currentCurrency={currentCurrency}
              />
            ) : (
              <span />
            )}
            <button
              type="button"
              data-testid="summary-show-details-btn"
              onClick={() => setShowDetails((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-base">
                {showDetails ? 'expand_less' : 'expand_more'}
              </span>
              {showDetails ? 'Hide details' : 'Show details'}
            </button>
          </div>
          <div className="flex flex-col gap-6">
            {people.map((person, index) => (
              <PersonCard
                key={person.id}
                person={person}
                colorIndex={index}
                split={displaySplit}
                discount={currentDiscount}
                serviceCharge={currentServiceCharge}
                gst={currentGst}
                showDetails={showDetails}
                currency={displayCurrency}
                qrDataUrl={qrDataUrls[person.id]}
                receiptBreakdown={
                  activeTab === 'total' && isMultiReceipt
                    ? receipts.map((r, i) => {
                        const receiptCurrency = r.currency ?? BASE_CURRENCY;
                        const usedSplit = showBaseCurrency
                          ? convertedSplitByReceipt[i]
                          : splitByReceipt[i];
                        const usedCurrency = showBaseCurrency ? BASE_CURRENCY : receiptCurrency;
                        return {
                          name: r.name || `Receipt ${i + 1}`,
                          split: usedSplit,
                          currency: usedCurrency,
                        };
                      })
                    : undefined
                }
              />
            ))}
            {people.length === 0 && (
              <p className="text-center text-on-surface-variant text-sm py-8">
                Add people to see the breakdown.
              </p>
            )}
          </div>
        </div>

        {/* Right: Grand total + export */}
        <div className="lg:col-span-4 flex flex-col gap-4 order-1 lg:order-2">
          <GrandTotalCard
            grandTotal={grandTotal}
            displayCurrency={displayCurrency}
            currentReceipt={currentReceipt ?? null}
            people={people}
            onRenameReceipt={onRenameReceipt}
          />
          <ExportActions
            busy={busy}
            copied={copied}
            exportError={exportError}
            nativeShareSupported={nativeShareSupported}
            onDownload={handleDownload}
            onShare={handleShare}
          />
        </div>
      </div>

      {/* Add receipt secondary action */}
      <div className="flex justify-center mb-4">
        <button
          type="button"
          data-testid="summary-add-receipt-btn"
          onClick={onAddReceipt}
          className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-base">add_box</span>
          Add new receipt
        </button>
      </div>
    </div>
  );
}
