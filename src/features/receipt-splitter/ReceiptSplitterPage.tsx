import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_MODELS,
  defaultGstState,
  defaultServiceChargeState,
} from './constants'
import type { EditableItem, Person } from './types'
import { computeSplit } from './logic/item-computation/split'
import { createEmptyItem, sanitizeItemAssignment } from './logic/item-assignment/items'
import { createId } from './logic/core/id'
import { parseCurrencyToCents } from './logic/core/money'
import {
  clearSessionGeminiApiKey,
  clearPersistedDraft,
  loadPersistedDraft,
  loadPersistedOcrSettings,
  loadSessionGeminiApiKey,
  saveSessionGeminiApiKey,
  savePersistedDraft,
  savePersistedOcrSettings,
} from './logic/autosave/storage'
import {
  analyzeReceiptWithGemini,
  applyOcrPayload,
  buildLocalMockOcrResponse,
} from './logic/item-extraction/ocr'
import { SetupPanel } from './components/SetupPanel'
import { LineItemsPanel } from './components/LineItemsPanel'
import { FinalSplitPanel } from './components/FinalSplitPanel'

export function ReceiptSplitterPage() {
  const [peopleInput, setPeopleInput] = useState('')
  const [people, setPeople] = useState<Person[]>([])
  const [items, setItems] = useState<EditableItem[]>(() => [createEmptyItem([])])
  const [serviceCharge, setServiceCharge] = useState(defaultServiceChargeState)
  const [gst, setGst] = useState(defaultGstState)
  const [receiptTotalInput, setReceiptTotalInput] = useState('')
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState('')
  const [rememberGeminiApiKey, setRememberGeminiApiKey] = useState(false)
  const [geminiModel, setGeminiModel] = useState<string>(DEFAULT_GEMINI_MODEL)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [scanStatus, setScanStatus] = useState('')
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanWarnings, setScanWarnings] = useState<string[]>([])
  const [didHydrateDraft, setDidHydrateDraft] = useState(false)

  useEffect(() => {
    const draft = loadPersistedDraft()
    if (draft) {
      setPeople(draft.people)
      setItems(draft.items.length > 0 ? draft.items : [createEmptyItem(draft.people)])
      setServiceCharge(draft.serviceCharge)
      setGst(draft.gst)
      setReceiptTotalInput(draft.receiptTotalInput)
    }

    const ocrSettings = loadPersistedOcrSettings()
    if (ocrSettings) {
      setGeminiModel(
        GEMINI_MODELS.includes(ocrSettings.geminiModel as (typeof GEMINI_MODELS)[number])
          ? ocrSettings.geminiModel
          : DEFAULT_GEMINI_MODEL,
      )
    }

    const sessionGeminiApiKey = loadSessionGeminiApiKey()
    if (sessionGeminiApiKey) {
      setGeminiApiKeyInput(sessionGeminiApiKey)
      setRememberGeminiApiKey(true)
    }

    setDidHydrateDraft(true)
  }, [])

  useEffect(() => {
    if (!didHydrateDraft) {
      return
    }

    setItems((currentItems) => currentItems.map((item) => sanitizeItemAssignment(item, people)))
  }, [didHydrateDraft, people])

  const split = useMemo(
    () => computeSplit({ people, items, serviceCharge, gst }),
    [people, items, serviceCharge, gst],
  )

  useEffect(() => {
    if (!didHydrateDraft) {
      return
    }

    savePersistedDraft({
      version: 1,
      people,
      items,
      serviceCharge,
      gst,
      receiptTotalInput,
      finalSplit: {
        subtotalCents: split.subtotalCents,
        serviceChargeCents: split.serviceChargeCents,
        gstCents: split.gstCents,
        grandTotalCents: split.grandTotalCents,
        totalByPersonCents: split.totalByPersonCents,
      },
      savedAt: new Date().toISOString(),
    })
  }, [didHydrateDraft, people, items, serviceCharge, gst, receiptTotalInput, split])

  useEffect(() => {
    if (!didHydrateDraft) {
      return
    }

    savePersistedOcrSettings({
      version: 1,
      geminiModel,
      savedAt: new Date().toISOString(),
    })
  }, [didHydrateDraft, geminiModel])

  useEffect(() => {
    if (!didHydrateDraft) {
      return
    }

    if (rememberGeminiApiKey && geminiApiKeyInput.trim()) {
      saveSessionGeminiApiKey(geminiApiKeyInput)
      return
    }

    clearSessionGeminiApiKey()
  }, [didHydrateDraft, geminiApiKeyInput, rememberGeminiApiKey])

  const receiptTotalCents = parseCurrencyToCents(receiptTotalInput)
  const reconciliationCents =
    receiptTotalCents === null ? null : receiptTotalCents - split.grandTotalCents

  const handlePeopleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    addPeopleFromInput(peopleInput)
  }

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

  const handleReceiptFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    if (file) {
      setItems([createEmptyItem(people)])
      setServiceCharge(defaultServiceChargeState)
      setGst(defaultGstState)
      setReceiptTotalInput('')
      setScanWarnings([])
      setScanError(null)
      clearPersistedDraft()
    }
    setReceiptFile(file)
  }

  const handleScanReceipt = async () => {
    if (!receiptFile) {
      return
    }

    if (!geminiApiKeyInput.trim()) {
      setScanError('Missing Gemini API key. Enter it in the OCR section.')
      return
    }

    setIsScanning(true)
    setScanStatus('Preparing Gemini request...')
    setScanError(null)
    setScanWarnings([])

    try {
      const payload = await analyzeReceiptWithGemini(
        receiptFile,
        geminiApiKeyInput,
        geminiModel,
        (nextStatus) => {
          setScanStatus(nextStatus)
        },
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
      setIsScanning(false)
      setScanStatus('')
    }
  }

  const handleLoadMockReceipt = () => {
    setScanError(null)
    setScanStatus('')
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
          <p className="max-w-3xl text-slate-300">
            Add people manually, scan a receipt, assign each line item, and get each person's final
            payable amount including service charge and GST.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr_1fr]">
          <SetupPanel
            peopleInput={peopleInput}
            onPeopleInputChange={setPeopleInput}
            onPeopleSubmit={handlePeopleSubmit}
            people={people}
            onRemovePerson={removePerson}
            onReceiptFileChange={handleReceiptFileChange}
            onScanReceipt={handleScanReceipt}
            onLoadMockReceipt={handleLoadMockReceipt}
            geminiApiKeyInput={geminiApiKeyInput}
            onGeminiApiKeyInputChange={setGeminiApiKeyInput}
            rememberGeminiApiKey={rememberGeminiApiKey}
            onRememberGeminiApiKeyChange={setRememberGeminiApiKey}
            geminiModel={geminiModel}
            geminiModels={GEMINI_MODELS}
            onGeminiModelChange={setGeminiModel}
            receiptFile={receiptFile}
            isScanning={isScanning}
            scanStatus={scanStatus}
            scanError={scanError}
            scanWarnings={scanWarnings}
            serviceCharge={serviceCharge}
            onServiceChargeChange={setServiceCharge}
            gst={gst}
            onGstChange={setGst}
            receiptTotalInput={receiptTotalInput}
            onReceiptTotalInputChange={setReceiptTotalInput}
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
          />
        </div>
      </div>
    </main>
  )
}
