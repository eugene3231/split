import { useMemo, useRef, useState } from 'react';
import { MOCK_RECEIPT_FIXTURES } from '@features/receipt-scanner/logic/ocrFixtures';
import { useShallow } from 'zustand/shallow';
import { useReceiptStore } from '@shared/stores/receiptStore';
import { useReceiptSplit } from '@shared/hooks/useReceiptSplit';
import { getAssignedItemsCount, getDetectedItemsCount } from '@pages/logic/wizardValidation';
import { useSimpleWizard } from '@pages/hooks/useSimpleWizard';
import { ProgressHeader } from '@pages/components/simple/ProgressHeader';
import { WizardNav } from '@pages/components/simple/WizardNav';
import { PeopleStep } from '@pages/components/simple/steps/PeopleStep';
import { ScanReceiptStep } from '@pages/components/simple/steps/ReceiptStep';
import { ItemsStep } from '@pages/components/simple/steps/ItemsStep';
import { SummaryStep } from '@pages/components/simple/steps/SummaryStep';

export function SimpleWorkspace() {
  const {
    people,
    receipts,
    activeReceiptId,
    addPeopleFromInput,
    removePerson,
    handleReceiptFileSelected,
    handleScanReceipt,
    applyMockToCurrentReceipt,
    addSimpleItem,
    removeItem,
    updateItem,
    normalizeItemsForSimpleMode,
    setDiscount,
    setServiceCharge,
    setGst,
    setReceiptTotalInput,
    setActiveReceiptId,
    removeReceipt,
    renameReceipt,
  } = useReceiptStore(
    useShallow((state) => ({
      people: state.people,
      receipts: state.receipts,
      activeReceiptId: state.activeReceiptId,
      addPeopleFromInput: state.addPeopleFromInput,
      removePerson: state.removePerson,
      handleReceiptFileSelected: state.handleReceiptFileSelected,
      handleScanReceipt: state.handleScanReceipt,
      applyMockToCurrentReceipt: state.applyMockToCurrentReceipt,
      addSimpleItem: state.addSimpleItem,
      removeItem: state.removeItem,
      updateItem: state.updateItem,
      normalizeItemsForSimpleMode: state.normalizeItemsForSimpleMode,
      setDiscount: state.setDiscount,
      setServiceCharge: state.setServiceCharge,
      setGst: state.setGst,
      setReceiptTotalInput: state.setReceiptTotalInput,
      setActiveReceiptId: state.setActiveReceiptId,
      removeReceipt: state.removeReceipt,
      renameReceipt: state.renameReceipt,
    })),
  );

  const activeReceipt = receipts.find((r) => r.id === activeReceiptId) ?? receipts[0];
  const items = useMemo(() => activeReceipt?.items ?? [], [activeReceipt]);
  const discount = activeReceipt?.discount;
  const serviceCharge = activeReceipt?.serviceCharge;
  const gst = activeReceipt?.gst;
  const receiptTotalInput = activeReceipt?.receiptTotalInput ?? '';

  const {
    split,
    consolidatedSplit,
    splitByReceipt,
    reconciliationCents,
    handleApplyReconciliationDiscount,
  } = useReceiptSplit();

  const {
    activeStep,
    itemsSubPhase,
    safeActiveItemIndex,
    setActiveItemIndex,
    setItemsSubPhase,
    canContinue,
    handleNext,
    handleBack,
    handleAddReceipt,
  } = useSimpleWizard(
    items,
    people,
    normalizeItemsForSimpleMode,
    receipts,
    activeReceiptId,
    setActiveReceiptId,
  );

  const peopleInput = useReceiptStore((state) => state.peopleInput);
  const setPeopleInput = useReceiptStore((state) => state.setPeopleInput);

  const detectedItemsCount = useMemo(() => getDetectedItemsCount(items), [items]);
  const assignedItemCount = useMemo(() => getAssignedItemsCount(items, people), [items, people]);

  const activeReceiptIndex = receipts.findIndex((r) => r.id === activeReceiptId);

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState('');
  const tabInputRef = useRef<HTMLInputElement>(null);

  const handleTabDoubleClick = (receiptId: string, currentName: string) => {
    setEditingTabId(receiptId);
    setEditingTabName(currentName);
    requestAnimationFrame(() => tabInputRef.current?.select());
  };

  const commitTabRename = () => {
    if (editingTabId) renameReceipt(editingTabId, editingTabName);
    setEditingTabId(null);
  };

  const handlePeopleSubmit = (event: { preventDefault(): void }) => {
    event.preventDefault();
    addPeopleFromInput(peopleInput);
  };

  if (!activeReceipt || !discount || !serviceCharge || !gst) {
    return null;
  }

  return (
    <section className="mx-auto w-full max-w-7xl space-y-4" data-testid="simple-wizard">
      <ProgressHeader
        activeStep={activeStep}
        context={{
          detectedItemsCount,
          activeItemIndex: safeActiveItemIndex,
          assignedItemCount,
          receiptNumber: activeReceiptIndex + 1,
          totalReceipts: receipts.length,
        }}
      />

      <div>
        {(activeStep === 'receipt' || activeStep === 'items') && receipts.length > 0 && (
          <div className="flex items-end gap-0.5">
            {receipts.map((receipt) => (
              <div
                key={receipt.id}
                onDoubleClick={() => handleTabDoubleClick(receipt.id, receipt.name)}
                onClick={() => setActiveReceiptId(receipt.id)}
                className={[
                  'flex items-center gap-1.5 rounded-t-xl border-t border-x pl-3 pr-2 py-2 text-xs font-medium transition -mb-px relative z-10 cursor-pointer select-none',
                  receipt.id === activeReceiptId
                    ? 'border-white/8 bg-slate-900/80 text-slate-100 shadow-xl shadow-black/25 backdrop-blur-sm'
                    : 'border-white/5 bg-slate-800/50 text-slate-500 hover:text-slate-300',
                ].join(' ')}
              >
                {editingTabId === receipt.id ? (
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
                    className="w-20 bg-transparent outline-none"
                    autoFocus
                  />
                ) : (
                  receipt.name
                )}
                {receipts.length > 1 && (
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeReceipt(receipt.id);
                    }}
                    aria-label={`Remove ${receipt.name}`}
                    className="flex h-3.5 w-3.5 items-center justify-center rounded text-slate-600 transition hover:text-rose-400"
                  >
                    <svg
                      width="8"
                      height="8"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </span>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddReceipt}
              className="relative z-10 -mb-px rounded-t-lg border-t border-x border-white/5 bg-slate-800/50 px-3 py-2 text-xs font-medium text-slate-600 transition hover:text-slate-400"
            >
              + Add
            </button>
          </div>
        )}

        <div
          className={[
            'border border-white/8 bg-slate-900/80 p-5 shadow-xl shadow-black/25 backdrop-blur-sm',
            (activeStep === 'receipt' || activeStep === 'items') && receipts.length > 0
              ? 'rounded-tr-2xl rounded-b-2xl'
              : 'rounded-2xl',
          ].join(' ')}
        >
          {activeStep === 'people' && (
            <PeopleStep
              people={people}
              peopleInput={peopleInput}
              onPeopleInputChange={setPeopleInput}
              onPeopleSubmit={handlePeopleSubmit}
              onRemovePerson={removePerson}
            />
          )}

          {activeStep === 'receipt' && (
            <ScanReceiptStep
              items={items}
              split={split}
              discount={discount}
              serviceCharge={serviceCharge}
              gst={gst}
              reconciliationCents={reconciliationCents}
              receiptTotalInput={receiptTotalInput}
              onApplyDiscount={handleApplyReconciliationDiscount}
              onReceiptFileSelected={handleReceiptFileSelected}
              onScanReceipt={handleScanReceipt}
              mockReceipts={MOCK_RECEIPT_FIXTURES.map((f, i) => ({
                label: f.label,
                onLoad: () => applyMockToCurrentReceipt(i),
              }))}
              onDiscountChange={setDiscount}
              onServiceChargeChange={setServiceCharge}
              onGstChange={setGst}
              onReceiptTotalInputChange={setReceiptTotalInput}
              onAddItem={addSimpleItem}
              onRemoveItem={removeItem}
              onUpdateItem={updateItem}
            />
          )}

          {activeStep === 'items' && (
            <ItemsStep
              items={items}
              people={people}
              itemsSubPhase={itemsSubPhase}
              activeItemIndex={safeActiveItemIndex}
              onActiveItemIndexChange={setActiveItemIndex}
              onItemsSubPhaseChange={setItemsSubPhase}
              onUpdateItem={updateItem}
            />
          )}

          {activeStep === 'final' && (
            <SummaryStep
              people={people}
              receipts={receipts}
              activeReceiptId={activeReceiptId}
              split={split}
              consolidatedSplit={consolidatedSplit}
              splitByReceipt={splitByReceipt}
              discount={discount}
              serviceCharge={serviceCharge}
              gst={gst}
              reconciliationCents={reconciliationCents}
              onApplyDiscount={handleApplyReconciliationDiscount}
            />
          )}
        </div>
      </div>

      <WizardNav
        activeStep={activeStep}
        itemsSubPhase={itemsSubPhase}
        isLastAssignableItem={
          safeActiveItemIndex >= items.length - 1 &&
          activeReceiptId === receipts[receipts.length - 1]?.id
        }
        canContinue={canContinue}
        onBack={handleBack}
        onNext={handleNext}
        onAddReceipt={handleAddReceipt}
      />
    </section>
  );
}
