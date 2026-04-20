import type { ChargeState, EditableItem, Receipt, SplitResult } from '@shared/types';
import { ReceiptImportActions } from '@features/workspace/components/shared/ReceiptImportActions';
import { LineItemCard } from '@features/workspace/components/shared/LineItemCard';
import { GlobalChargesPanel } from '@features/workspace/components/shared/GlobalChargesPanel';
import { ReceiptTabs } from '@features/workspace/components/shared/ReceiptTabs';
import { ReceiptNameField } from '@features/workspace/components/shared/ReceiptNameField';
import { CurrencySelector } from '@features/workspace/components/shared/CurrencySelector';
import { ExchangeRateDisplay } from '@features/workspace/components/shared/ExchangeRateDisplay';
import { useReceiptStore } from '@features/workspace/stores/receiptStore';
import { BASE_CURRENCY } from '@shared/constants';

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
  const setReceiptCurrency = useReceiptStore((s) => s.setReceiptCurrency);
  const hasItems = items.length > 0;
  const activeReceipt = receipts.find((r) => r.id === activeReceiptId);
  const activeCurrency = activeReceipt?.currency ?? BASE_CURRENCY;
  return (
    <div>
      {/* Step header — desktop */}
      <div className="mb-6 hidden md:block">
        <h1 className="font-headline mb-2 text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">
          Add Receipts
        </h1>
        <p className="text-lg text-on-surface-variant">
          Verify scanned items and add missing charges.
        </p>
      </div>

      {/* Step header — mobile */}
      <div className="mb-4 md:hidden">
        <h1 className="font-headline text-xl font-extrabold tracking-tight text-on-surface">
          Add Receipts
        </h1>
        <p className="mt-0.5 text-xs text-on-surface-variant">
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
      <div className="mb-6">
        <ReceiptImportActions
          onReceiptFileSelected={onReceiptFileSelected}
          onScanReceipt={onScanReceipt}
          mockReceipts={mockReceipts}
        />
      </div>

      {/* Layout: left 8 cols + right 4 cols */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        {/* Left: Image placeholder + items */}
        <div className="space-y-6 lg:col-span-8">
          {/* Compact image placeholder */}
          <div className="flex items-center gap-4 rounded-2xl bg-surface-container-lowest px-5 py-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-surface-container">
              <span className="material-symbols-outlined text-2xl text-outline">receipt_long</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
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
          </div>

          {/* Line items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold tracking-widest text-on-surface-variant uppercase">
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
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-outline-variant p-4 text-on-surface-variant transition-all hover:bg-surface-container-low hover:text-primary"
                >
                  <span className="material-symbols-outlined">add_circle</span>
                  <span className="text-sm font-bold tracking-widest uppercase">Add New Item</span>
                </button>
              </div>
            ) : (
              <div
                data-testid="receipt-empty-state"
                className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-outline-variant/30 bg-surface-bright py-12 text-center"
              >
                <span className="material-symbols-outlined text-3xl text-outline">receipt</span>
                <p className="text-sm font-semibold text-on-surface-variant">No items yet</p>
                <p className="text-sm text-outline">Scan a receipt or add items manually below.</p>
                <button
                  type="button"
                  data-testid="receipt-add-item-btn"
                  onClick={onAddItem}
                  className="mt-2 flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container px-4 py-2 text-sm font-bold text-on-primary transition-transform active:scale-95"
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
