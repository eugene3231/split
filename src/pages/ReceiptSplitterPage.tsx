import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/shallow'
import { defaultGstState, defaultServiceChargeState } from '../shared/constants'
import type { EditableItem, Person } from '../shared/types'
import { computeSplit } from '../shared/logic/computation/split'
import { createEmptyItem, sanitizeItemAssignment } from '../shared/logic/assignment/items'
import { createId } from '../shared/logic/core/id'
import { parseCurrencyToCents } from '../shared/logic/core/money'
import { clearPersistedDraft } from '../shared/api/storage'
import {
  analyzeReceiptWithGemini,
  applyOcrPayload,
  buildLocalMockOcrResponse,
  ReceiptImportPanel,
  useGeminiSettings,
  useLoadingTicker,
} from '../features/receipt-import'
import { LineItemsPanel } from '../features/item-assignment'
import { SetupPanel } from '../features/receipt-setup'
import { FinalSplitPanel } from '../features/split-summary'
import { ExportImageSection } from '../features/split-export'
import { useDraftPersistence } from '../shared/hooks/useDraftPersistence'
import { useReceiptUiStore } from '../shared/stores/receiptUiStore'

export function ReceiptSplitterPage() {
  const {
    geminiApiKeyInput,
    geminiModel,
    receiptFile,
    isScanning,
    setPeopleInput,
    setReceiptFile,
    setScanStatus,
    setScanError,
    setScanWarnings,
    clearScanFeedback,
    startScan,
    finishScan,
    advanceLoadingMessage,
  } = useReceiptUiStore(
    useShallow((state) => ({
      geminiApiKeyInput: state.geminiApiKeyInput,
      geminiModel: state.geminiModel,
      receiptFile: state.receiptFile,
      isScanning: state.isScanning,
      setPeopleInput: state.setPeopleInput,
      setReceiptFile: state.setReceiptFile,
      setScanStatus: state.setScanStatus,
      setScanError: state.setScanError,
      setScanWarnings: state.setScanWarnings,
      clearScanFeedback: state.clearScanFeedback,
      startScan: state.startScan,
      finishScan: state.finishScan,
      advanceLoadingMessage: state.advanceLoadingMessage,
    })),
  )
  const [people, setPeople] = useState<Person[]>([])
  const [items, setItems] = useState<EditableItem[]>(() => [createEmptyItem([])])
  const [serviceCharge, setServiceCharge] = useState(defaultServiceChargeState)
  const [gst, setGst] = useState(defaultGstState)
  const [receiptTotalInput, setReceiptTotalInput] = useState('')

  const split = useMemo(
    () => computeSplit({ people, items, serviceCharge, gst }),
    [people, items, serviceCharge, gst],
  )

  useDraftPersistence({
    people,
    setPeople,
    items,
    setItems,
    serviceCharge,
    setServiceCharge,
    gst,
    setGst,
    receiptTotalInput,
    setReceiptTotalInput,
    split,
  })
  useGeminiSettings()
  useLoadingTicker({ isActive: isScanning, onTick: advanceLoadingMessage })

  useEffect(() => {
    setItems((currentItems) => currentItems.map((item) => sanitizeItemAssignment(item, people)))
  }, [people])

  const receiptTotalCents = parseCurrencyToCents(receiptTotalInput)
  const reconciliationCents =
    receiptTotalCents === null ? null : receiptTotalCents - split.grandTotalCents

  const addPeopleFromInput = (rawInput: string) => {
    const nextNames = rawInput
      .split(/[\n,]+/)
      .map((name) => name.trim())
      .filter((name) => name.length > 0)

    if (nextNames.length === 0) {
      return
    }

    setPeople((currentPeople) => {
      const existing = new Set(currentPeople.map((person) => person.name.toLowerCase()))
      const additions = nextNames
        .filter((name) => !existing.has(name.toLowerCase()))
        .map((name) => ({ id: createId(), name }))

      if (additions.length === 0) {
        return currentPeople
      }

      return [...currentPeople, ...additions]
    })

    setPeopleInput('')
  }

  const removePerson = (personId: string) => {
    setPeople((currentPeople) => currentPeople.filter((person) => person.id !== personId))
  }

  const addItem = () => {
    setItems((currentItems) => [...currentItems, createEmptyItem(people)])
  }

  const removeItem = (itemId: string) => {
    setItems((currentItems) => {
      if (currentItems.length <= 1) {
        return currentItems
      }
      return currentItems.filter((item) => item.id !== itemId)
    })
  }

  const updateItem = (itemId: string, updater: (item: EditableItem) => EditableItem) => {
    setItems((currentItems) =>
      currentItems.map((item) => (item.id === itemId ? updater(item) : item)),
    )
  }

  const handleReceiptFileSelected = (file: File | null) => {
    if (file) {
      setItems([createEmptyItem(people)])
      setServiceCharge(defaultServiceChargeState)
      setGst(defaultGstState)
      setReceiptTotalInput('')
      clearPersistedDraft()
    }
    clearScanFeedback()
    setReceiptFile(file)
  }

  const handleScanReceipt = async () => {
    if (!receiptFile) {
      return
    }

    if (!geminiApiKeyInput.trim()) {
      setScanError('Missing Gemini API key. Enter it above.')
      return
    }

    startScan()

    try {
      const payload = await analyzeReceiptWithGemini(
        receiptFile,
        geminiApiKeyInput,
        geminiModel,
        setScanStatus,
      )
      applyOcrPayload(
        payload,
        people,
        setItems,
        setServiceCharge,
        setGst,
        setScanWarnings,
        setReceiptTotalInput,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to scan receipt'
      setScanError(message)
    } finally {
      finishScan()
    }
  }

  const handleLoadMockReceipt = () => {
    clearScanFeedback()
    const payload = buildLocalMockOcrResponse('Loaded local mock receipt data.')
    applyOcrPayload(
      payload,
      people,
      setItems,
      setServiceCharge,
      setGst,
      setScanWarnings,
      setReceiptTotalInput,
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6 p-4 pb-10 sm:p-6 lg:p-8">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">Split Bills</p>
          <h1 className="text-3xl font-bold tracking-tight">Receipt Splitter</h1>
          <p className="w-full text-slate-300">
            Add people manually, scan a receipt, assign each line item, and get each person's final
            payable amount including service charge and GST.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr_1fr]">
          <SetupPanel
            people={people}
            onAddPeople={addPeopleFromInput}
            onRemovePerson={removePerson}
            serviceCharge={serviceCharge}
            onServiceChargeChange={setServiceCharge}
            gst={gst}
            onGstChange={setGst}
            receiptTotalInput={receiptTotalInput}
            onReceiptTotalInputChange={setReceiptTotalInput}
            importSection={
              <ReceiptImportPanel
                onReceiptFileSelected={handleReceiptFileSelected}
                onScanReceipt={handleScanReceipt}
                onLoadMockReceipt={handleLoadMockReceipt}
              />
            }
          />

          <LineItemsPanel
            people={people}
            items={items}
            onAddItem={addItem}
            onRemoveItem={removeItem}
            onUpdateItem={updateItem}
          />

          <FinalSplitPanel
            people={people}
            split={split}
            reconciliationCents={reconciliationCents}
            serviceCharge={serviceCharge}
            gst={gst}
            exportSection={
              <ExportImageSection
                people={people}
                split={split}
                serviceCharge={serviceCharge}
                gst={gst}
                reconciliationCents={reconciliationCents}
              />
            }
          />
        </div>
      </div>
    </main>
  )
}
