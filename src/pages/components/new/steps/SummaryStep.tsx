import { useRef, useState } from 'react';
import type { ChargeState, Person, Receipt, SplitResult } from '@shared/types';
import { formatCurrencyFromCents, getCurrencySymbol } from '@shared/logic/core/money';
import { generateReceiptSplitImageLight } from '@features/split-results/logic/receiptSplitImageLight';
import {
  buildSplitShareText,
  copyShareText,
  downloadImage,
} from '@features/split-results/logic/shareSplit';
import { PersonCard } from '@pages/components/new/shared/PersonCard';
import { ReceiptNameField } from '@pages/components/new/shared/ReceiptNameField';
import { BASE_CURRENCY } from '@shared/constants';
import { cn } from '@shared/utils/cn';
import { convertSplitResult } from '@shared/logic/core/exchangeRates';
import { useReceiptStore } from '@shared/stores/receiptStore';

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
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState('');
  const tabInputRef = useRef<HTMLInputElement>(null);
  const copyTimeoutRef = useRef<number | null>(null);

  const startEditingTab = (id: string, name: string) => {
    setEditingTabId(id);
    setEditingTabName(name);
    requestAnimationFrame(() => tabInputRef.current?.select());
  };

  const commitTabRename = () => {
    if (editingTabId && editingTabName.trim()) onRenameReceipt(editingTabId, editingTabName.trim());
    setEditingTabId(null);
  };

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
  const exchangeRates = useReceiptStore((s) => s.exchangeRates);
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

  const handleDownload = async () => {
    setBusy('downloading');
    setExportError(null);
    try {
      const blob = await generateReceiptSplitImageLight({
        people,
        split: displaySplit,
        receipts,
        splitByReceipt,
        discount: currentDiscount,
        serviceCharge: currentServiceCharge,
        gst: currentGst,
        receiptName: currentReceipt?.name,
        reconciliationCents,
        includeItemDetails: showDetails,
        currency: displayCurrency,
      });
      await downloadImage(blob, 'split-result.png');
    } catch {
      setExportError('Failed to generate image.');
    } finally {
      setBusy(null);
    }
  };

  const handleCopy = async () => {
    setBusy('copying');
    const text = buildSplitShareText({
      people,
      receiptName: currentReceipt?.name ?? '',
      split: displaySplit,
      currency: displayCurrency,
    });
    try {
      await copyShareText(text);
      setBusy(null);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
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
          <div className="flex overflow-x-auto gap-3 pb-1" style={{ scrollbarWidth: 'none' }}>
            <button
              type="button"
              data-testid="summary-tab-total"
              onClick={() => setActiveTab('total')}
              className={cn(
                'flex-shrink-0 px-6 py-2.5 rounded-full font-bold transition-all',
                activeTab === 'total'
                  ? 'bg-primary text-on-primary shadow-md shadow-primary/20'
                  : 'bg-surface-container-high text-on-surface-variant font-semibold hover:bg-surface-container-highest',
              )}
            >
              Total ({receipts.length} receipts)
            </button>
            {receipts.map((r, index) => (
              <div
                key={r.id}
                data-testid={`summary-tab-receipt-${index}`}
                onClick={() => setActiveTab(r.id)}
                onDoubleClick={() => startEditingTab(r.id, r.name || `Receipt ${index + 1}`)}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1.5 px-6 py-2.5 rounded-full font-semibold transition-all cursor-pointer select-none',
                  activeTab === r.id
                    ? 'bg-primary text-on-primary shadow-md shadow-primary/20'
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest',
                )}
              >
                {editingTabId === r.id ? (
                  <input
                    ref={tabInputRef}
                    value={editingTabName}
                    onChange={(e) => setEditingTabName(e.target.value)}
                    onBlur={commitTabRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitTabRename();
                      if (e.key === 'Escape') setEditingTabId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    size={Math.max(editingTabName.length, 6)}
                    className="bg-transparent outline-none font-semibold text-on-primary"
                    autoFocus
                  />
                ) : (
                  <>
                    {r.name || `Receipt ${index + 1}`}
                    {activeTab === r.id && (
                      <span
                        className="material-symbols-outlined !text-xs opacity-70"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditingTab(r.id, r.name || `Receipt ${index + 1}`);
                        }}
                      >
                        edit
                      </span>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
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
              <div className="flex items-center gap-1 bg-surface-container rounded-full p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setShowBaseCurrency(false)}
                  className={cn(
                    'px-3 py-1 rounded-full transition-all',
                    !showBaseCurrency
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface',
                  )}
                >
                  {activeTab === 'total'
                    ? 'Original'
                    : `${getCurrencySymbol(currentCurrency)} ${currentCurrency}`}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBaseCurrency(true)}
                  className={cn(
                    'px-3 py-1 rounded-full transition-all',
                    showBaseCurrency
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface',
                  )}
                >
                  {getCurrencySymbol(BASE_CURRENCY)} {BASE_CURRENCY}
                </button>
              </div>
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
          {/* Grand total card */}
          <div
            className="rounded-2xl p-6 text-left shadow-md"
            style={{ background: 'linear-gradient(135deg, #2d6a7f 0%, #1e5068 100%)' }}
          >
            <div className="flex items-start justify-between mb-4">
              <span className="text-sm font-bold uppercase tracking-widest text-white flex-1 min-w-0 mr-2">
                {currentReceipt ? (
                  <ReceiptNameField
                    key={currentReceipt.id}
                    name={currentReceipt.name}
                    onRename={(name) => onRenameReceipt(currentReceipt.id, name)}
                    className="text-white placeholder:text-white/40"
                    iconClassName="text-white"
                  />
                ) : (
                  'Grand Total'
                )}
              </span>
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-white/50 text-sm">
                  account_balance_wallet
                </span>
              </div>
            </div>
            <div className="flex items-baseline gap-1 mb-5">
              <span className="text-xl font-semibold text-white/60">
                {getCurrencySymbol(displayCurrency)}
              </span>
              <span className="text-4xl font-semibold text-white font-headline leading-none">
                {(grandTotal / 100).toFixed(2)}
              </span>
            </div>
            <div className="border-t border-white/10 pt-4 flex items-center gap-2.5">
              <span
                className="material-symbols-outlined !text-sm text-cyan-300"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                verified
              </span>
              <span className="text-sm font-medium text-white">
                Fully reconciled across {people.length} {people.length === 1 ? 'person' : 'people'}
              </span>
            </div>
          </div>

          {/* Export actions */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              data-testid="export-save-image-btn"
              onClick={handleDownload}
              disabled={busy !== null}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-surface-container-highest text-primary font-bold text-sm hover:bg-primary hover:text-on-primary transition-all disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-base">image</span>
              {busy === 'downloading' ? 'Generating…' : 'Save Image'}
            </button>
            <button
              type="button"
              data-testid="export-copy-text-btn"
              onClick={handleCopy}
              disabled={busy !== null}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-outline-variant/30 text-primary font-bold text-sm hover:border-primary transition-all disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-base">
                {copied ? 'check' : 'content_copy'}
              </span>
              {copied ? 'Copied!' : busy === 'copying' ? 'Copying…' : 'Copy Text'}
            </button>
            {exportError && <p className="text-sm text-error">{exportError}</p>}
          </div>
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
