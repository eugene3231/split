import { ReceiptImportActions } from './ReceiptImportActions';
import { StepHeader } from '@features/split-workspace/components/shared/StepHeader';
import { LineItemCard } from '@features/split-workspace/components/shared/LineItemCard';
import { GlobalChargesPanel } from '@features/split-workspace/components/shared/GlobalChargesPanel';
import {
  AddReceiptButton,
  ReceiptTab,
  ReceiptTabs,
} from '@features/split-workspace/components/shared/ReceiptTabs';
import { CurrencySelector } from '@features/split-workspace/components/shared/CurrencySelector';
import { ExchangeRateDisplay } from '@features/split-workspace/components/shared/ExchangeRateDisplay';
import { useReceiptImport } from './useReceiptImport';
import { useShallow } from 'zustand/shallow';
import {
  selectActiveReceipt,
  useReceiptStore,
} from '@features/split-workspace/stores/receiptStore';
import { BASE_CURRENCY } from '@shared/constants';

type Props = {
  onAddReceipt: () => void;
};

export function ReceiptStep({ onAddReceipt }: Props) {
  const {
    receipts,
    addItem,
    removeItem,
    updateItem,
    setActiveReceiptId,
    removeReceipt,
    renameReceipt,
    setReceiptCurrency,
  } = useReceiptStore(
    useShallow((state) => ({
      receipts: state.receipts,
      addItem: state.addItem,
      removeItem: state.removeItem,
      updateItem: state.updateItem,
      setActiveReceiptId: state.setActiveReceiptId,
      removeReceipt: state.removeReceipt,
      renameReceipt: state.renameReceipt,
      setReceiptCurrency: state.setReceiptCurrency,
    })),
  );
  const receipt = useReceiptStore(selectActiveReceipt);
  const { handleReceiptFileChange, handleScanReceipt } = useReceiptImport({
    activeReceiptId: receipt.id,
  });
  const { items, currency } = receipt;
  const hasItems = items.length > 0;

  return (
    <div>
      <StepHeader
        title="Add receipts"
        description="Scan a receipt or enter the items and charges."
        className="mb-6"
      />

      <ReceiptTabs
        value={receipt.id}
        onValueChange={setActiveReceiptId}
        className="mb-6"
        action={<AddReceiptButton data-testid="receipt-add-receipt-btn" onClick={onAddReceipt} />}
      >
        {receipts.map((tab) => (
          <ReceiptTab
            key={tab.id}
            value={tab.id}
            label={tab.name}
            onRename={(name) => renameReceipt(tab.id, name)}
            onRemove={receipts.length > 1 ? () => removeReceipt(tab.id) : undefined}
          />
        ))}
      </ReceiptTabs>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="space-y-6 lg:col-span-8">
          <ReceiptImportActions
            onReceiptFileSelected={handleReceiptFileChange}
            onScanReceipt={handleScanReceipt}
          />

          <section aria-labelledby="receipt-items-heading" className="overflow-hidden surface-card">
            <header className="flex items-center justify-between gap-3 border-b border-surface-container-high px-4 py-3 md:px-5">
              <h2
                id="receipt-items-heading"
                className="font-headline text-lg leading-tight font-bold text-on-surface"
              >
                Items{' '}
                {hasItems && (
                  <span className="ml-2 font-body text-sm font-medium text-on-surface-variant">
                    {items.length}
                  </span>
                )}
              </h2>
              <CurrencySelector
                value={currency}
                onChange={(next) => setReceiptCurrency(receipt.id, next)}
              />
            </header>

            {currency !== BASE_CURRENCY && (
              <div className="border-b border-surface-container-high bg-surface-container-low px-4 py-2.5 md:px-5">
                <ExchangeRateDisplay
                  receiptId={receipt.id}
                  currency={currency}
                  exchangeRateOverride={receipt.exchangeRateOverride}
                />
              </div>
            )}

            {hasItems ? (
              <>
                <ul className="divide-y divide-surface-container-high">
                  {items.map((item) => (
                    <LineItemCard
                      key={item.id}
                      item={item}
                      discount={receipt.discount}
                      currency={currency}
                      onUpdate={(update) => updateItem(receipt.id, item.id, update)}
                      onRemove={() => removeItem(receipt.id, item.id)}
                    />
                  ))}
                </ul>
                <button
                  type="button"
                  data-testid="receipt-add-item-btn"
                  onClick={() => addItem(receipt.id)}
                  className="flex w-full items-center gap-2 border-t border-surface-container-high px-4 py-3.5 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface md:px-5"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-xl">
                    add
                  </span>
                  Add item
                </button>
              </>
            ) : (
              <div
                data-testid="receipt-empty-state"
                className="flex flex-col items-center justify-center gap-1 px-6 py-10 text-center"
              >
                <p className="text-sm font-semibold text-on-surface">No items yet</p>
                <p className="text-sm text-on-surface-variant">
                  Scan a receipt above, or add the items yourself.
                </p>
                <button
                  type="button"
                  data-testid="receipt-add-item-btn"
                  onClick={() => addItem(receipt.id)}
                  className="mt-3 flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-container"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-lg">
                    add
                  </span>
                  Add item
                </button>
              </div>
            )}
          </section>
        </div>

        <div className="lg:col-span-4">
          <GlobalChargesPanel receipt={receipt} />
        </div>
      </div>
    </div>
  );
}
