import { useState } from 'react'
import { useShallow } from 'zustand/shallow'
import { LineItemsPanel } from '@features/split-config'
import { ReceiptImportPanel } from '@features/receipt-scanner'
import { SetupPanel } from '@features/split-config'
import { FinalSplitPanel } from '@features/split-results'
import { useReceiptStore } from '@shared/stores/receiptStore'
import { useReceiptSplit } from '@shared/hooks/useReceiptSplit'
import { JsonImportExportSection } from '@pages/components/advanced/JsonImportExportSection'
import type { Receipt } from '@shared/types'
import { ExportSplitImageSection } from '@features/split-results/components/ExportSplitImageSection'

export function AdvancedWorkspace() {
  const {
    people,
    receipts,
    activeReceiptId,
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
    addReceipt,
    removeReceipt,
    setActiveReceiptId,
    renameReceipt,
  } = useReceiptStore(
    useShallow((state) => ({
      people: state.people,
      receipts: state.receipts,
      activeReceiptId: state.activeReceiptId,
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
      addReceipt: state.addReceipt,
      removeReceipt: state.removeReceipt,
      setActiveReceiptId: state.setActiveReceiptId,
      renameReceipt: state.renameReceipt,
    })),
  )

  const { split, consolidatedSplit, reconciliationCents, handleApplyReconciliationDiscount } = useReceiptSplit()

  const activeReceipt = receipts.find((r) => r.id === activeReceiptId) ?? receipts[0]
  const items = activeReceipt?.items ?? []
  const discount = activeReceipt?.discount
  const serviceCharge = activeReceipt?.serviceCharge
  const gst = activeReceipt?.gst
  const receiptTotalInput = activeReceipt?.receiptTotalInput ?? ''

  const isMultiReceipt = receipts.length > 1
  const displaySplit = isMultiReceipt ? consolidatedSplit : split

  if (!activeReceipt || !discount || !serviceCharge || !gst) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Receipt tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {receipts.map((r, index) => (
          <ReceiptTab
            key={r.id}
            receipt={r}
            index={index}
            isActive={r.id === activeReceiptId}
            canRemove={receipts.length > 1}
            onSelect={() => setActiveReceiptId(r.id)}
            onRemove={() => removeReceipt(r.id)}
            onRename={(name) => renameReceipt(r.id, name)}
          />
        ))}
        <button
          type="button"
          onClick={addReceipt}
          className="rounded-lg border border-dashed border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-slate-400 hover:text-slate-200"
        >
          + Add Receipt
        </button>
      </div>

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
                onLoadMockReceipt={() => handleLoadMockReceipt(0)}
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
          split={displaySplit}
          reconciliationCents={isMultiReceipt ? null : reconciliationCents}
          discount={discount}
          serviceCharge={serviceCharge}
          gst={gst}
          onApplyDiscount={isMultiReceipt ? undefined : handleApplyReconciliationDiscount}
          exportSection={
            <ExportSplitImageSection
              people={people}
              split={displaySplit}
              discount={discount}
              serviceCharge={serviceCharge}
              gst={gst}
              reconciliationCents={isMultiReceipt ? null : reconciliationCents}
              receiptName={isMultiReceipt ? undefined : activeReceipt.name}
            />
          }
        />
      </div>
    </div>
  )
}

type ReceiptTabProps = {
  receipt: Receipt
  index: number
  isActive: boolean
  canRemove: boolean
  onSelect: () => void
  onRemove: () => void
  onRename: (name: string) => void
}

function ReceiptTab({ receipt, index, isActive, canRemove, onSelect, onRemove, onRename }: ReceiptTabProps) {
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(receipt.name)

  const handleDoubleClick = () => {
    setDraftName(receipt.name)
    setEditing(true)
  }

  const commitRename = () => {
    setEditing(false)
    onRename(draftName)
  }

  return (
    <div
      className={[
        'flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition',
        isActive
          ? 'border-sky-500/50 bg-sky-500/15 text-sky-200'
          : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500 hover:text-slate-200',
      ].join(' ')}
    >
      {editing ? (
        <input
          autoFocus
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') setEditing(false)
          }}
          className="w-24 bg-transparent text-xs text-slate-100 outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={onSelect}
          onDoubleClick={handleDoubleClick}
          title="Double-click to rename"
          className="max-w-[120px] truncate"
        >
          {receipt.name || `Receipt ${index + 1}`}
        </button>
      )}
      {canRemove && !editing ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="ml-0.5 rounded px-0.5 text-slate-500 hover:text-rose-400"
          title="Remove receipt"
        >
          ×
        </button>
      ) : null}
    </div>
  )
}
