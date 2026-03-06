import { useMemo, useState, type ReactNode } from 'react'
import { useShallow } from 'zustand/shallow'
import { defaultGstState, defaultServiceChargeState } from '../shared/constants'
import type { ChargeState, EditableItem, Person, SplitResult } from '../shared/types'
import { computeSplit } from '../shared/logic/computation/split'
import { createEmptyItem, sanitizeItemAssignment } from '../shared/logic/assignment/items'
import { createId } from '../shared/logic/core/id'
import { parseCurrencyToCents } from '../shared/logic/core/money'
import { clearPersistedDraft, loadPersistedDraft } from '../shared/api/storage'
import {
  analyzeReceiptWithGemini,
  applyOcrPayload,
  buildLocalMockOcrResponse,
  buildSimpleModeMockOcrResponse,
  ReceiptImportPanel,
  useLoadingTicker,
} from '../features/receipt-import'
import { LineItemsPanel } from '../features/item-assignment'
import { SetupPanel } from '../features/receipt-setup'
import { FinalSplitPanel } from '../features/split-summary'
import { ExportImageSection } from '../features/split-export'
import {
  buildNewSimpleItem,
  convertItemsToSimpleEqualMode,
  SimpleWizardShell,
} from '../features/simple-wizard'
import { useDraftPersistence } from '../shared/hooks/useDraftPersistence'
import { useReceiptUiStore } from '../shared/stores/receiptUiStore'

export function ReceiptSplitterPage() {
  const {
    uxMode,
    setUxMode,
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
      uxMode: state.uxMode,
      setUxMode: state.setUxMode,
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
  const [initialDraft] = useState(() => loadPersistedDraft())
  const [people, setPeople] = useState<Person[]>(() => initialDraft?.people ?? [])
  const [items, setItems] = useState<EditableItem[]>(() =>
    buildInitialItems(initialDraft?.items ?? [], initialDraft?.people ?? [], uxMode),
  )
  const [serviceCharge, setServiceCharge] = useState(
    () => initialDraft?.serviceCharge ?? defaultServiceChargeState,
  )
  const [gst, setGst] = useState(() => initialDraft?.gst ?? defaultGstState)
  const [receiptTotalInput, setReceiptTotalInput] = useState(
    () => initialDraft?.receiptTotalInput ?? '',
  )

  const split = useMemo(
    () => computeSplit({ people, items, serviceCharge, gst }),
    [people, items, serviceCharge, gst],
  )

  useDraftPersistence({
    people,
    items,
    serviceCharge,
    gst,
    receiptTotalInput,
    split,
  })
  useLoadingTicker({ isActive: isScanning, onTick: advanceLoadingMessage })

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

      const nextPeople = [...currentPeople, ...additions]
      setItems((currentItems) => syncItemsWithPeople(currentItems, nextPeople, uxMode))
      return nextPeople
    })

    setPeopleInput('')
  }

  const removePerson = (personId: string) => {
    setPeople((currentPeople) => {
      const nextPeople = currentPeople.filter((person) => person.id !== personId)
      setItems((currentItems) => syncItemsWithPeople(currentItems, nextPeople, uxMode))
      return nextPeople
    })
  }

  const addAdvancedItem = () => {
    setItems((currentItems) => [...currentItems, createEmptyItem(people)])
  }

  const addSimpleItem = () => {
    setItems((currentItems) => [...currentItems, buildNewSimpleItem(people)])
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
      setItems([uxMode === 'simple' ? buildNewSimpleItem(people) : createEmptyItem(people)])
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
      if (uxMode === 'simple') {
        setItems((currentItems) => convertItemsToSimpleEqualMode(currentItems, people))
      }
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
    if (uxMode === 'simple') {
      setItems((currentItems) => convertItemsToSimpleEqualMode(currentItems, people))
    }
  }

  const handleLoadSimpleMockReceipt = () => {
    clearScanFeedback()
    const payload = buildSimpleModeMockOcrResponse()
    applyOcrPayload(
      payload,
      people,
      setItems,
      setServiceCharge,
      setGst,
      setScanWarnings,
      setReceiptTotalInput,
    )
    setItems((currentItems) => convertItemsToSimpleEqualMode(currentItems, people))
  }

  const normalizeItemsForSimpleMode = () => {
    setItems((currentItems) => convertItemsToSimpleEqualMode(currentItems, people))
  }

  const handleUxModeChange = (nextMode: 'simple' | 'advanced') => {
    if (nextMode === uxMode) {
      return
    }

    if (nextMode === 'simple') {
      setItems((currentItems) => convertItemsToSimpleEqualMode(currentItems, people))
    }

    setUxMode(nextMode)
  }

  const exportSection = (
    <ExportImageSection
      people={people}
      split={split}
      serviceCharge={serviceCharge}
      gst={gst}
      reconciliationCents={reconciliationCents}
    />
  )

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
          <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleUxModeChange('simple')}
              className={`rounded-md px-3 py-1.5 transition ${
                uxMode === 'simple'
                  ? 'bg-sky-500 text-slate-950'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Simple Mode
            </button>
            <button
              type="button"
              onClick={() => handleUxModeChange('advanced')}
              className={`rounded-md px-3 py-1.5 transition ${
                uxMode === 'advanced'
                  ? 'bg-sky-500 text-slate-950'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Advanced Mode
            </button>
          </div>
        </header>

        {uxMode === 'simple' ? (
          <SimpleWizardShell
            people={people}
            items={items}
            serviceCharge={serviceCharge}
            gst={gst}
            receiptTotalInput={receiptTotalInput}
            split={split}
            reconciliationCents={reconciliationCents}
            onAddPeople={addPeopleFromInput}
            onRemovePerson={removePerson}
            onReceiptFileSelected={handleReceiptFileSelected}
            onScanReceipt={handleScanReceipt}
            onLoadMockReceipt={handleLoadSimpleMockReceipt}
            onAddSimpleItem={addSimpleItem}
            onRemoveItem={removeItem}
            onUpdateItem={updateItem}
            onNormalizeItemsForSimpleMode={normalizeItemsForSimpleMode}
            onServiceChargeChange={setServiceCharge}
            onGstChange={setGst}
            onReceiptTotalInputChange={setReceiptTotalInput}
            exportSection={exportSection}
          />
        ) : (
          <AdvancedWorkspace
            people={people}
            items={items}
            serviceCharge={serviceCharge}
            gst={gst}
            receiptTotalInput={receiptTotalInput}
            split={split}
            reconciliationCents={reconciliationCents}
            onAddPeople={addPeopleFromInput}
            onRemovePerson={removePerson}
            onServiceChargeChange={setServiceCharge}
            onGstChange={setGst}
            onReceiptTotalInputChange={setReceiptTotalInput}
            onReceiptFileSelected={handleReceiptFileSelected}
            onScanReceipt={handleScanReceipt}
            onLoadMockReceipt={handleLoadMockReceipt}
            onAddItem={addAdvancedItem}
            onRemoveItem={removeItem}
            onUpdateItem={updateItem}
            exportSection={exportSection}
          />
        )}
      </div>
    </main>
  )
}

function syncItemsWithPeople(
  items: EditableItem[],
  people: Person[],
  uxMode: 'simple' | 'advanced',
): EditableItem[] {
  const sanitizedItems = items.map((item) => sanitizeItemAssignment(item, people))
  if (uxMode !== 'simple' || people.length === 0) {
    return sanitizedItems
  }

  return convertItemsToSimpleEqualMode(sanitizedItems, people)
}

function buildInitialItems(
  items: EditableItem[],
  people: Person[],
  uxMode: 'simple' | 'advanced',
): EditableItem[] {
  if (items.length === 0) {
    return [uxMode === 'simple' ? buildNewSimpleItem(people) : createEmptyItem(people)]
  }

  return syncItemsWithPeople(items, people, uxMode)
}

type AdvancedWorkspaceProps = {
  people: Person[]
  items: EditableItem[]
  serviceCharge: ChargeState
  gst: ChargeState
  receiptTotalInput: string
  split: SplitResult
  reconciliationCents: number | null
  onAddPeople: (rawInput: string) => void
  onRemovePerson: (personId: string) => void
  onServiceChargeChange: (next: ChargeState) => void
  onGstChange: (next: ChargeState) => void
  onReceiptTotalInputChange: (value: string) => void
  onReceiptFileSelected: (file: File | null) => void
  onScanReceipt: () => void
  onLoadMockReceipt: () => void
  onAddItem: () => void
  onRemoveItem: (itemId: string) => void
  onUpdateItem: (itemId: string, updater: (item: EditableItem) => EditableItem) => void
  exportSection: ReactNode
}

function AdvancedWorkspace({
  people,
  items,
  serviceCharge,
  gst,
  receiptTotalInput,
  split,
  reconciliationCents,
  onAddPeople,
  onRemovePerson,
  onServiceChargeChange,
  onGstChange,
  onReceiptTotalInputChange,
  onReceiptFileSelected,
  onScanReceipt,
  onLoadMockReceipt,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  exportSection,
}: AdvancedWorkspaceProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr_1fr]">
      <SetupPanel
        people={people}
        onAddPeople={onAddPeople}
        onRemovePerson={onRemovePerson}
        serviceCharge={serviceCharge}
        onServiceChargeChange={onServiceChargeChange}
        gst={gst}
        onGstChange={onGstChange}
        receiptTotalInput={receiptTotalInput}
        onReceiptTotalInputChange={onReceiptTotalInputChange}
        importSection={
          <ReceiptImportPanel
            onReceiptFileSelected={onReceiptFileSelected}
            onScanReceipt={onScanReceipt}
            onLoadMockReceipt={onLoadMockReceipt}
          />
        }
      />

      <LineItemsPanel
        people={people}
        items={items}
        onAddItem={onAddItem}
        onRemoveItem={onRemoveItem}
        onUpdateItem={onUpdateItem}
      />

      <FinalSplitPanel
        people={people}
        split={split}
        reconciliationCents={reconciliationCents}
        serviceCharge={serviceCharge}
        gst={gst}
        exportSection={exportSection}
      />
    </div>
  )
}
