import { useState } from 'react';
import type { ChargeState, EditableItem, Receipt, SplitResult } from '@shared/types';
import { ReceiptImportActions } from '@pages/components/new/shared/ReceiptImportActions';
import { LineItemCard } from '@pages/components/new/shared/LineItemCard';
import { GlobalChargesPanel } from '@pages/components/new/shared/GlobalChargesPanel';
import { ReceiptTabs } from '@pages/components/new/shared/ReceiptTabs';
import { ReceiptNameField } from '@pages/components/new/shared/ReceiptNameField';
import { CurrencySelector } from '@pages/components/new/shared/CurrencySelector';
import { ExchangeRateDisplay } from '@pages/components/new/shared/ExchangeRateDisplay';
import { useReceiptStore } from '@shared/stores/receiptStore';
import { BASE_CURRENCY } from '@shared/constants';
import { cn } from '@shared/utils/cn';

type Props = {
  receipts: Receipt[];
  activeReceiptId: string;
  onSelectReceipt: (id: string) => void;
  onAddReceipt: () => void;
  onRemoveReceipt: (id: string) => void;
  onRenameReceipt: (id: string, name: string) => void;
  items: EditableItem[];
  split: SplitResult;
  discount: ChargeState;
  serviceCharge: ChargeState;
  gst: ChargeState;
  reconciliationCents: number | null;
  receiptTotalInput: string;
  onApplyDiscount: () => void;
  onReceiptFileSelected: (file: File | null) => void;
  onScanReceipt: () => void;
  mockReceipts: Array<{ label: string; onLoad: () => void }>;
  onDiscountChange: (discount: ChargeState) => void;
  onServiceChargeChange: (serviceCharge: ChargeState) => void;
  onGstChange: (gst: ChargeState) => void;
  onReceiptTotalInputChange: (value: string) => void;
  onAddItem: () => void;
  onRemoveItem: (id: string) => void;
  onUpdateItem: (id: string, updater: (current: EditableItem) => EditableItem) => void;
};

export function ReceiptStep({
  receipts,
  activeReceiptId,
  onSelectReceipt,
  onAddReceipt,
  onRemoveReceipt,
  onRenameReceipt,
  items,
  split,
  discount,
  serviceCharge,
  gst,
  reconciliationCents,
  receiptTotalInput,
  onApplyDiscount,
  onReceiptFileSelected,
  onScanReceipt,
  mockReceipts,
  onDiscountChange,
  onServiceChargeChange,
  onGstChange,
  onReceiptTotalInputChange,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
}: Props) {
  const [hasUpload, setHasUpload] = useState(false);
  const hasApiKey = useReceiptStore((s) => s.geminiApiKeyInput.trim().length > 0);
  const setReceiptCurrency = useReceiptStore((s) => s.setReceiptCurrency);
  const hasItems = items.length > 0;
  const activeReceipt = receipts.find((r) => r.id === activeReceiptId);
  const activeCurrency = activeReceipt?.currency ?? BASE_CURRENCY;
  return (
    <div>
      {/* Step header — desktop */}
      <div className="mb-6 hidden md:block">
        <h1 className="text-4xl md:text-5xl font-extrabold font-headline tracking-tight text-on-surface mb-2">
          Add Receipts
        </h1>
        <p className="text-on-surface-variant text-lg">
          Verify scanned items and add missing charges.
        </p>
      </div>

      {/* Step header — mobile */}
      <div className="mb-4 md:hidden">
        <h1 className="text-xl font-extrabold font-headline text-on-surface tracking-tight">
          Add Receipts
        </h1>
        <p className="text-on-surface-variant text-xs mt-0.5">
          Verify scanned items and add missing charges.
        </p>
      </div>

      <ReceiptTabs
        receipts={receipts}
        activeReceiptId={activeReceiptId}
        onSelect={onSelectReceipt}
        onRemove={onRemoveReceipt}
        onRename={onRenameReceipt}
        appendTab={{
          icon: 'add',
          label: 'Add Receipt',
          isActive: false,
          onClick: onAddReceipt,
        }}
      />

      {/* Import actions row */}
      <div className={cn('mb-6 rounded-2xl', hasUpload && !hasApiKey && 'ring-2 ring-error')}>
        <ReceiptImportActions
          onReceiptFileSelected={(file) => {
            setHasUpload(file !== null);
            onReceiptFileSelected(file);
          }}
          onScanReceipt={onScanReceipt}
          mockReceipts={mockReceipts}
        />
      </div>

      {/* Layout: left 8 cols + right 4 cols */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left: Image placeholder + items */}
        <div className="lg:col-span-8 space-y-6">
          {/* Compact image placeholder */}
          <div className="flex items-center gap-4 bg-surface-container-lowest rounded-2xl px-5 py-4">
            <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-2xl text-outline">receipt_long</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <ReceiptNameField
                  key={activeReceiptId}
                  name={activeReceipt?.name ?? ''}
                  onRename={(name) => onRenameReceipt(activeReceiptId, name)}
                />
                <CurrencySelector
                  value={activeCurrency}
                  onChange={(currency) => setReceiptCurrency(activeReceiptId, currency)}
                />
              </div>
              {activeCurrency !== BASE_CURRENCY && activeReceipt && (
                <div className="mt-1">
                  <ExchangeRateDisplay
                    receiptId={activeReceiptId}
                    currency={activeCurrency}
                    exchangeRateOverride={activeReceipt.exchangeRateOverride}
                  />
                </div>
              )}
              {activeCurrency === BASE_CURRENCY && (
                <p className="text-xs text-on-surface-variant">
                  Upload or scan to extract line items
                </p>
              )}
            </div>
            <span className="material-symbols-outlined text-outline text-base">fullscreen</span>
          </div>

          {/* Line items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
                Line Items
              </h3>
              {hasItems && (
                <span className="text-sm font-medium text-outline">
                  {items.length} item{items.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {hasItems ? (
              <div className="space-y-3">
                {items.map((item) => (
                  <LineItemCard
                    key={item.id}
                    item={item}
                    discount={discount}
                    currency={activeCurrency}
                    onUpdate={(updater) => onUpdateItem(item.id, updater)}
                    onRemove={() => onRemoveItem(item.id)}
                  />
                ))}

                {/* Add item button */}
                <button
                  type="button"
                  data-testid="receipt-add-item-btn"
                  onClick={onAddItem}
                  className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-outline-variant rounded-2xl text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-all"
                >
                  <span className="material-symbols-outlined">add_circle</span>
                  <span className="font-bold uppercase text-sm tracking-widest">Add New Item</span>
                </button>
              </div>
            ) : (
              <div
                data-testid="receipt-empty-state"
                className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-outline-variant/30 rounded-2xl bg-surface-bright text-center gap-3"
              >
                <span className="material-symbols-outlined text-3xl text-outline">receipt</span>
                <p className="text-sm font-semibold text-on-surface-variant">No items yet</p>
                <p className="text-sm text-outline">Scan a receipt or add items manually below.</p>
                <button
                  type="button"
                  data-testid="receipt-add-item-btn"
                  onClick={onAddItem}
                  className="mt-2 flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-xl font-bold text-sm active:scale-95 transition-transform"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  Add Item
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Global charges sidebar */}
        <div className="lg:col-span-4">
          <GlobalChargesPanel
            split={split}
            discount={discount}
            serviceCharge={serviceCharge}
            gst={gst}
            reconciliationCents={reconciliationCents}
            receiptTotalInput={receiptTotalInput}
            onApplyDiscount={onApplyDiscount}
            onDiscountChange={onDiscountChange}
            onServiceChargeChange={onServiceChargeChange}
            onGstChange={onGstChange}
            onReceiptTotalInputChange={onReceiptTotalInputChange}
            currency={activeCurrency}
          />
        </div>
      </div>
    </div>
  );
}
