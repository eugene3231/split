import { ReceiptImportActions } from './ReceiptImportActions';
import { LineItemCard } from '@features/split-workspace/components/shared/LineItemCard';
import { GlobalChargesPanel } from '@features/split-workspace/components/shared/GlobalChargesPanel';
import { ReceiptTabs } from '@features/split-workspace/components/shared/ReceiptTabs';
import { ReceiptNameField } from '@features/split-workspace/components/shared/ReceiptNameField';
import { CurrencySelector } from '@features/split-workspace/components/shared/CurrencySelector';
import { ExchangeRateDisplay } from '@features/split-workspace/components/shared/ExchangeRateDisplay';
import { useReceiptImport } from './useReceiptImport';
import { useReceiptStepModel } from './useReceiptStepModel';
import { BASE_CURRENCY } from '@shared/constants';

type Props = {
  onAddReceipt: () => void;
};

export function ReceiptStep({ onAddReceipt }: Props) {
  const {
    receipts,
    activeReceiptId,
    activeReceipt,
    items,
    discount,
    serviceCharge,
    gst,
    receiptTotalInput,
    activeCurrency,
    hasItems,
    activeSplit,
    reconciliation,
    addItem,
    removeItem,
    updateItem,
    setDiscount,
    setServiceCharge,
    setGst,
    setReceiptTotalInput,
    setActiveReceiptId,
    removeReceipt,
    renameReceipt,
    setReceiptCurrency,
  } = useReceiptStepModel();
  const { handleReceiptFileChange, handleScanReceipt, mockReceipts } = useReceiptImport({
    activeReceiptId,
  });

  if (!activeReceipt || !discount || !serviceCharge || !gst) {
    return null;
  }

  return (
    <div>
      <div className="mb-6 hidden md:block">
        <h1 className="font-headline mb-2 text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">
          Add Receipts
        </h1>
        <p className="text-lg text-on-surface-variant">
          Verify scanned items and add missing charges.
        </p>
      </div>

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
        onSelect={setActiveReceiptId}
        onRemove={removeReceipt}
        onRename={renameReceipt}
        appendTab={{
          icon: 'add',
          label: 'Add Receipt',
          isActive: false,
          onClick: onAddReceipt,
        }}
      />

      <div className="mb-6">
        <ReceiptImportActions
          onReceiptFileSelected={handleReceiptFileChange}
          onScanReceipt={handleScanReceipt}
          mockReceipts={mockReceipts}
        />
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <div className="flex items-center gap-4 rounded-2xl bg-surface-container-lowest px-5 py-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-surface-container">
              <span className="material-symbols-outlined text-2xl text-outline">receipt_long</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <ReceiptNameField
                  key={activeReceiptId}
                  name={activeReceipt.name}
                  onRename={(name) => renameReceipt(activeReceiptId, name)}
                />
                <CurrencySelector
                  value={activeCurrency}
                  onChange={(currency) => setReceiptCurrency(activeReceiptId, currency)}
                />
              </div>
              {activeCurrency !== BASE_CURRENCY ? (
                <div className="mt-1">
                  <ExchangeRateDisplay
                    receiptId={activeReceiptId}
                    currency={activeCurrency}
                    exchangeRateOverride={activeReceipt.exchangeRateOverride}
                  />
                </div>
              ) : (
                <p className="text-xs text-on-surface-variant">
                  Upload or scan to extract line items
                </p>
              )}
            </div>
          </div>

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
                    onUpdate={(updater) => updateItem(item.id, updater)}
                    onRemove={() => removeItem(item.id)}
                  />
                ))}

                <button
                  type="button"
                  data-testid="receipt-add-item-btn"
                  onClick={addItem}
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
                  onClick={addItem}
                  className="mt-2 flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container px-4 py-2 text-sm font-bold text-on-primary transition-transform active:scale-95"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  Add Item
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4">
          <GlobalChargesPanel
            split={activeSplit}
            discount={discount}
            serviceCharge={serviceCharge}
            gst={gst}
            reconciliationCents={reconciliation.cents}
            receiptTotalInput={receiptTotalInput}
            onApplyDiscount={reconciliation.applyCorrectiveDiscount}
            onDiscountChange={setDiscount}
            onServiceChargeChange={setServiceCharge}
            onGstChange={setGst}
            onReceiptTotalInputChange={setReceiptTotalInput}
            currency={activeCurrency}
          />
        </div>
      </div>
    </div>
  );
}
