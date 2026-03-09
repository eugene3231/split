import { useMemo } from 'react'
import { useShallow } from 'zustand/shallow'
import { useReceiptStore } from '../../../shared/stores/receiptStore'
import { useReceiptSplit } from '../../../shared/hooks/useReceiptSplit'
import { getAssignedItemsCount, getDetectedItemsCount } from '../../logic/wizardValidation'
import { useSimpleWizard } from '../../hooks/useSimpleWizard'
import { ProgressHeader } from './ProgressHeader'
import { WizardNav } from './WizardNav'
import { PeopleStep } from './steps/PeopleStep'
import { ReceiptStep } from './steps/ReceiptStep'
import { ItemsStep } from './steps/ItemsStep'
import { FinalStep } from './steps/FinalStep'

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
  } = useReceiptStore(
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

  const { split, reconciliationCents, handleApplyReconciliationDiscount } = useReceiptSplit()

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

  const peopleInput = useReceiptStore((state) => state.peopleInput)
  const setPeopleInput = useReceiptStore((state) => state.setPeopleInput)

  const detectedItemsCount = useMemo(() => getDetectedItemsCount(items), [items])
  const assignedItemCount = useMemo(() => getAssignedItemsCount(items, people), [items, people])

  const handlePeopleSubmit = (event: { preventDefault(): void }) => {
    event.preventDefault()
    addPeopleFromInput(peopleInput)
  }

  return (
    <section className="mx-auto w-full max-w-7xl space-y-4" data-testid="simple-wizard">
      <ProgressHeader
        activeStep={activeStep}
        context={{
          detectedItemsCount,
          activeItemIndex: safeActiveItemIndex,
          assignedItemCount,
        }}
      />

      <div className="rounded-2xl border border-white/8 bg-slate-900/80 p-5 shadow-xl shadow-black/25 backdrop-blur-sm">
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
          <FinalStep
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

      <WizardNav
        activeStep={activeStep}
        itemsSubPhase={itemsSubPhase}
        canContinue={canContinue}
        onBack={handleBack}
        onNext={handleNext}
      />
    </section>
  )
}
