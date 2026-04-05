import { useMemo } from 'react'
import { useShallow } from 'zustand/shallow'
import { MOCK_RECEIPT_FIXTURES } from '@features/receipt-scanner/logic/ocrFixtures'
import { useReceiptStore } from '@shared/stores/receiptStore'
import { useReceiptSplit } from '@shared/hooks/useReceiptSplit'
import { getAssignedItemsCount, getDetectedItemsCount } from '@pages/logic/wizardValidation'
import { useSimpleWizard } from '@pages/hooks/useSimpleWizard'
import { useReceiptSplitterController } from '@pages/hooks/useReceiptSplitterController'
import { TopAppBar } from '@pages/components/new/TopAppBar'
import { BottomNav } from '@pages/components/new/BottomNav'
import { PeopleStep } from '@pages/components/new/steps/PeopleStep'
import { ReceiptStep } from '@pages/components/new/steps/ReceiptStep'
import { AssignStep } from '@pages/components/new/steps/AssignStep'
import { SummaryStep } from '@pages/components/new/steps/SummaryStep'

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function NewWorkspace() {
  useReceiptSplitterController()

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
      peopleInput: state.peopleInput,
      setPeopleInput: state.setPeopleInput,
    })),
  )

  const activeReceipt = receipts.find((r) => r.id === activeReceiptId) ?? receipts[0]
  const items = useMemo(() => activeReceipt?.items ?? [], [activeReceipt])
  const discount = activeReceipt?.discount
  const serviceCharge = activeReceipt?.serviceCharge
  const gst = activeReceipt?.gst
  const receiptTotalInput = activeReceipt?.receiptTotalInput ?? ''

  const { split, consolidatedSplit, splitByReceipt, reconciliationCents, handleApplyReconciliationDiscount } = useReceiptSplit()

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
  } = useSimpleWizard(items, people, normalizeItemsForSimpleMode)

  const detectedItemsCount = useMemo(() => getDetectedItemsCount(items), [items])
  const assignedItemCount = useMemo(() => getAssignedItemsCount(items, people), [items, people])

  const grandTotalCents = useMemo(
    () => Object.values(consolidatedSplit?.totalByPersonCents ?? split?.totalByPersonCents ?? {}).reduce((sum, v) => sum + v, 0),
    [consolidatedSplit, split],
  )
  const grandTotalFormatted = grandTotalCents > 0 ? formatCents(grandTotalCents) : undefined

  const handlePeopleSubmit = (e: { preventDefault(): void }) => {
    e.preventDefault()
    addPeopleFromInput(peopleInput)
  }

  const handleNextWithScroll = () => {
    handleNext()
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const handleBackWithScroll = () => {
    handleBack()
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  if (!activeReceipt || !discount || !serviceCharge || !gst) {
    return null
  }

  return (
    <div className="bg-surface text-on-surface font-body min-h-screen flex flex-col" data-testid="simple-wizard">
      <TopAppBar
        activeStep={activeStep}
        itemsSubPhase={itemsSubPhase}
        assignedItemCount={assignedItemCount}
        detectedItemsCount={detectedItemsCount}
      />

      <main className="flex-grow max-w-7xl mx-auto w-full px-6 md:px-8 pt-4 md:pt-10 pb-48">
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
            onAddItem={addSimpleItem}
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
        isLastAssignableItem={safeActiveItemIndex >= items.length - 1}
        canContinue={canContinue}
        onBack={handleBackWithScroll}
        onNext={handleNextWithScroll}
        grandTotalFormatted={grandTotalFormatted}
      />
    </div>
  )
}
