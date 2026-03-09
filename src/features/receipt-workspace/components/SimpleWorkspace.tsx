import { useMemo } from 'react'
import { useShallow } from 'zustand/shallow'
import { computeSplit } from '../../../shared/logic/computation/split'
import { useReceiptUiStore } from '../../../shared/stores/receiptUiStore'
import { useReconciliation } from '../../../shared/hooks/useReconciliation'
import { useReceiptWorkspaceStore } from '../store/receiptWorkspaceStore'
import { getAssignedItemsCount, getDetectedItemsCount } from '../logic/wizardValidation'
import { useSimpleWizard } from '../logic/useSimpleWizard'
import { SimpleProgressHeader } from './SimpleProgressHeader'
import { SimpleWizardNav } from './SimpleWizardNav'
import { SimpleStepPeople } from './steps/SimpleStepPeople'
import { SimpleStepReceipt } from './steps/SimpleStepReceipt'
import { SimpleStepItems } from './steps/SimpleStepItems'
import { SimpleStepFinal } from './steps/SimpleStepFinal'

export function SimpleWorkspace() {
  const {
    people,
    items,
    discount,
    serviceCharge,
    gst,
    receiptTotalInput,
    addPeopleFromInput,
    removePerson,
    handleReceiptFileSelected,
    handleScanReceipt,
    handleLoadSimpleMockReceipt,
    addSimpleItem,
    removeItem,
    updateItem,
    normalizeItemsForSimpleMode,
    setDiscount,
    setServiceCharge,
    setGst,
    setReceiptTotalInput,
  } = useReceiptWorkspaceStore(
    useShallow((state) => ({
      people: state.people,
      items: state.items,
      discount: state.discount,
      serviceCharge: state.serviceCharge,
      gst: state.gst,
      receiptTotalInput: state.receiptTotalInput,
      addPeopleFromInput: state.addPeopleFromInput,
      removePerson: state.removePerson,
      handleReceiptFileSelected: state.handleReceiptFileSelected,
      handleScanReceipt: state.handleScanReceipt,
      handleLoadSimpleMockReceipt: state.handleLoadSimpleMockReceipt,
      addSimpleItem: state.addSimpleItem,
      removeItem: state.removeItem,
      updateItem: state.updateItem,
      normalizeItemsForSimpleMode: state.normalizeItemsForSimpleMode,
      setDiscount: state.setDiscount,
      setServiceCharge: state.setServiceCharge,
      setGst: state.setGst,
      setReceiptTotalInput: state.setReceiptTotalInput,
    })),
  )

  const split = useMemo(
    () => computeSplit({ people, items, discount, serviceCharge, gst }),
    [people, items, discount, serviceCharge, gst],
  )

  const { reconciliationCents, handleApplyReconciliationDiscount } = useReconciliation(
    split,
    discount,
    setDiscount,
    receiptTotalInput,
  )

  const {
    activeStep,
    itemsSubPhase,
    safeActiveItemIndex,
    setActiveItemIndex,
    setItemsSubPhase,
    canContinue,
    handleNext,
    handleBack,
  } = useSimpleWizard(items, people, normalizeItemsForSimpleMode)

  const peopleInput = useReceiptUiStore((state) => state.peopleInput)
  const setPeopleInput = useReceiptUiStore((state) => state.setPeopleInput)

  const detectedItemsCount = useMemo(() => getDetectedItemsCount(items), [items])
  const assignedItemCount = useMemo(() => getAssignedItemsCount(items, people), [items, people])

  const handlePeopleSubmit = (event: { preventDefault(): void }) => {
    event.preventDefault()
    addPeopleFromInput(peopleInput)
  }

  return (
    <section className="mx-auto w-full max-w-7xl space-y-4" data-testid="simple-wizard">
      <SimpleProgressHeader
        activeStep={activeStep}
        context={{
          detectedItemsCount,
          activeItemIndex: safeActiveItemIndex,
          assignedItemCount,
        }}
      />

      <div className="rounded-2xl border border-white/8 bg-slate-900/80 p-5 shadow-xl shadow-black/25 backdrop-blur-sm">
        {activeStep === 'people' && (
          <SimpleStepPeople
            people={people}
            peopleInput={peopleInput}
            onPeopleInputChange={setPeopleInput}
            onPeopleSubmit={handlePeopleSubmit}
            onRemovePerson={removePerson}
          />
        )}

        {activeStep === 'receipt' && (
          <SimpleStepReceipt
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
            onLoadMockReceipt={handleLoadSimpleMockReceipt}
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
          <SimpleStepItems
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
          <SimpleStepFinal
            people={people}
            split={split}
            discount={discount}
            serviceCharge={serviceCharge}
            gst={gst}
            reconciliationCents={reconciliationCents}
            onApplyDiscount={handleApplyReconciliationDiscount}
          />
        )}
      </div>

      <SimpleWizardNav
        activeStep={activeStep}
        itemsSubPhase={itemsSubPhase}
        canContinue={canContinue}
        onBack={handleBack}
        onNext={handleNext}
      />
    </section>
  )
}
