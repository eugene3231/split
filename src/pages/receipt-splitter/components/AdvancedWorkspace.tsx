import { useMemo } from 'react'
import { useShallow } from 'zustand/shallow'
import { LineItemsPanel } from '../../../features/split-config'
import { ReceiptImportPanel } from '../../../features/receipt-scanner'
import { SetupPanel } from '../../../features/split-config'
import { ExportImageSection } from '../../../features/split-results'
import { FinalSplitPanel } from '../../../features/split-results'
import { computeSplit } from '../../../shared/logic/computation/split'
import { useReceiptWorkspaceStore } from '../../../shared/stores/receiptWorkspaceStore'
import { useReconciliation } from '../../../shared/hooks/useReconciliation'
import { JsonImportExportSection } from './JsonImportExportSection'

export function AdvancedWorkspace() {
  const {
    people,
    items,
    discount,
    serviceCharge,
    gst,
    receiptTotalInput,
    addPeopleFromInput,
    removePerson,
    setDiscount,
    setServiceCharge,
    setGst,
    setReceiptTotalInput,
    handleReceiptFileSelected,
    handleScanReceipt,
    handleLoadMockReceipt,
    getExportJson,
    importFromJson,
    addAdvancedItem,
    removeItem,
    updateItem,
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
      setDiscount: state.setDiscount,
      setServiceCharge: state.setServiceCharge,
      setGst: state.setGst,
      setReceiptTotalInput: state.setReceiptTotalInput,
      handleReceiptFileSelected: state.handleReceiptFileSelected,
      handleScanReceipt: state.handleScanReceipt,
      handleLoadMockReceipt: state.handleLoadMockReceipt,
      getExportJson: state.getExportJson,
      importFromJson: state.importFromJson,
      addAdvancedItem: state.addAdvancedItem,
      removeItem: state.removeItem,
      updateItem: state.updateItem,
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

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr_1fr]">
      <SetupPanel
        people={people}
        onAddPeople={addPeopleFromInput}
        onRemovePerson={removePerson}
        discount={discount}
        onDiscountChange={setDiscount}
        serviceCharge={serviceCharge}
        onServiceChargeChange={setServiceCharge}
        gst={gst}
        onGstChange={setGst}
        receiptTotalInput={receiptTotalInput}
        onReceiptTotalInputChange={setReceiptTotalInput}
        importSection={
          <>
            <ReceiptImportPanel
              onReceiptFileSelected={handleReceiptFileSelected}
              onScanReceipt={handleScanReceipt}
              onLoadMockReceipt={handleLoadMockReceipt}
            />
            <JsonImportExportSection
              onGetJson={getExportJson}
              onImportJson={importFromJson}
            />
          </>
        }
      />

      <LineItemsPanel
        people={people}
        items={items}
        onAddItem={addAdvancedItem}
        onRemoveItem={removeItem}
        onUpdateItem={updateItem}
        globalDiscount={discount}
      />

      <FinalSplitPanel
        people={people}
        split={split}
        reconciliationCents={reconciliationCents}
        discount={discount}
        serviceCharge={serviceCharge}
        gst={gst}
        onApplyDiscount={handleApplyReconciliationDiscount}
        exportSection={
          <ExportImageSection
            people={people}
            split={split}
            discount={discount}
            serviceCharge={serviceCharge}
            gst={gst}
            reconciliationCents={reconciliationCents}
          />
        }
      />
    </div>
  )
}
