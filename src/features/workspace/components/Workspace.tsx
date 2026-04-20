import { useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { MOCK_RECEIPT_FIXTURES } from '@features/receipt-scanner/logic/ocrFixtures';
import { useReceiptStore } from '@features/workspace/stores/receiptStore';
import { useReceiptSplit } from '@features/workspace/hooks/useReceiptSplit';
import {
  getAssignedItemsCount,
  getDetectedItemsCount,
} from '@features/workspace/logic/wizardValidation';
import { useWizard } from '@features/workspace/hooks/useWizard';
import { useReceiptSplitterController } from '@features/workspace/hooks/useReceiptSplitterController';
import { TopAppBar } from '@features/workspace/components/TopAppBar';
import { BottomNav } from '@features/workspace/components/BottomNav';
import { PeopleStep } from '@features/workspace/components/steps/PeopleStep';
import { ReceiptStep } from '@features/workspace/components/steps/ReceiptStep';
import { AssignStep } from '@features/workspace/components/steps/AssignStep';
import { SummaryStep } from '@features/workspace/components/steps/SummaryStep';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function Workspace() {
  useReceiptSplitterController();

  const {
    people,
    receipts,
    activeReceiptId,
    addPeopleFromInput,
    removePerson,
    handleReceiptFileSelected,
    handleScanReceipt,
    applyMockToCurrentReceipt,
    addItem,
    removeItem,
    updateItem,
    normalizeItems,
    setDiscount,
    setServiceCharge,
    setGst,
    setReceiptTotalInput,
    setActiveReceiptId,
    removeReceipt,
    renameReceipt,
    peopleInput,
    setPeopleInput,
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
      addItem: state.addItem,
      removeItem: state.removeItem,
      updateItem: state.updateItem,
      normalizeItems: state.normalizeItems,
      setDiscount: state.setDiscount,
      setServiceCharge: state.setServiceCharge,
      setGst: state.setGst,
      setReceiptTotalInput: state.setReceiptTotalInput,
      setActiveReceiptId: state.setActiveReceiptId,
      removeReceipt: state.removeReceipt,
      renameReceipt: state.renameReceipt,
      peopleInput: state.peopleInput,
      setPeopleInput: state.setPeopleInput,
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
  } = useWizard(items, people, normalizeItems, receipts, activeReceiptId, setActiveReceiptId);

  const detectedItemsCount = useMemo(() => getDetectedItemsCount(items), [items]);
  const assignedItemCount = useMemo(() => getAssignedItemsCount(items, people), [items, people]);

  const grandTotalCents = useMemo(
    () =>
      Object.values(
        consolidatedSplit?.totalByPersonCents ?? split?.totalByPersonCents ?? {},
      ).reduce((sum, v) => sum + v, 0),
    [consolidatedSplit, split],
  );
  const grandTotalFormatted = grandTotalCents > 0 ? formatCents(grandTotalCents) : undefined;

  const handlePeopleSubmit = (e: { preventDefault(): void }) => {
    e.preventDefault();
    addPeopleFromInput(peopleInput);
  };

  const handleNextWithScroll = () => {
    handleNext();
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleBackWithScroll = () => {
    handleBack();
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  if (!activeReceipt || !discount || !serviceCharge || !gst) {
    return null;
  }

  return (
    <div
      className="font-body flex min-h-screen flex-col bg-surface text-on-surface"
      data-testid="workspace"
    >
      <TopAppBar
        activeStep={activeStep}
        itemsSubPhase={itemsSubPhase}
        assignedItemCount={assignedItemCount}
        detectedItemsCount={detectedItemsCount}
      />

      <main className="mx-auto w-full max-w-7xl flex-grow px-6 pt-4 pb-48 md:px-8 md:pt-10">
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
          <ReceiptStep
            receipts={receipts}
            activeReceiptId={activeReceiptId}
            onSelectReceipt={setActiveReceiptId}
            onAddReceipt={handleAddReceipt}
            onRemoveReceipt={removeReceipt}
            onRenameReceipt={renameReceipt}
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
            onAddItem={addItem}
            onRemoveItem={removeItem}
            onUpdateItem={updateItem}
          />
        )}

        {activeStep === 'items' && (
          <AssignStep
            receipts={receipts}
            activeReceiptId={activeReceiptId}
            onSelectReceipt={setActiveReceiptId}
            onRenameReceipt={renameReceipt}
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
            onAddReceipt={handleAddReceipt}
            onRenameReceipt={renameReceipt}
          />
        )}
      </main>

      <BottomNav
        activeStep={activeStep}
        itemsSubPhase={itemsSubPhase}
        isLastAssignableItem={
          safeActiveItemIndex >= items.length - 1 &&
          activeReceiptId === receipts[receipts.length - 1]?.id
        }
        canContinue={canContinue}
        onBack={handleBackWithScroll}
        onNext={handleNextWithScroll}
        grandTotalFormatted={grandTotalFormatted}
      />
    </div>
  );
}
