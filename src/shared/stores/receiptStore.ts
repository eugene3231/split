import type { SetStateAction } from 'react'
import { create } from 'zustand'
import {
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '../constants'
import {
  clearPersistedDraft,
  clearSessionGeminiApiKey,
  exportDraftToJson,
  importDraftFromJson,
  loadPersistedDraft,
  loadPersistedOcrSettings,
  loadPersistedUxMode,
  loadSessionGeminiApiKey,
  savePersistedOcrSettings,
  savePersistedUxMode,
  saveSessionGeminiApiKey,
} from '../api/storage'
import { createEmptyItem } from '../logic/assignment/items'
import { createId } from '../logic/core/id'
import { normalizeGeminiModel } from '../logic/core/geminiModel'
import {
  FUNNY_LOADING_MESSAGES,
  getRandomLoadingMessageIndex,
} from '../logic/core/loadingMessages'
import type { ChargeState, EditableItem, Person } from '../types'
import {
  analyzeReceiptWithGemini,
  applyOcrPayload,
  buildLocalMockOcrResponse,
  buildSimpleModeMockOcrResponse,
} from '../../features/receipt-scanner'
import {
  buildInitialItems,
  createSimpleEmptyItem,
  convertItemsToSimpleEqualMode,
  syncItemsWithPeople,
} from '../logic/assignment/simpleAssignments'

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

function loadInitialGeminiModel(): string {
  const persistedSettings = loadPersistedOcrSettings()
  return normalizeGeminiModel(persistedSettings?.geminiModel ?? '')
}

function loadInitialGeminiApiKey(): string {
  return loadSessionGeminiApiKey()
}

function syncGeminiApiKeyPersistence(apiKey: string, rememberApiKey: boolean): void {
  if (rememberApiKey && apiKey.trim()) {
    saveSessionGeminiApiKey(apiKey)
    return
  }

  clearSessionGeminiApiKey()
}

function resolveSetStateAction<T>(current: T, next: SetStateAction<T>): T {
  return typeof next === 'function' ? (next as (previous: T) => T)(current) : next
}

// ---------------------------------------------------------------------------
// Combined store type
// ---------------------------------------------------------------------------

type ReceiptStoreState = {
  // UI state (from receiptUiStore)
  uxMode: 'simple' | 'advanced'
  peopleInput: string
  geminiApiKeyInput: string
  rememberGeminiApiKey: boolean
  geminiModel: string
  receiptFile: File | null
  isScanning: boolean
  scanStatus: string
  scanError: string | null
  scanWarnings: string[]
  loadingMessage: string
  loadingMessageIndex: number
  showApiKeyModal: boolean

  // Workspace state (from receiptWorkspaceStore)
  initialized: boolean
  people: Person[]
  items: EditableItem[]
  discount: ChargeState
  serviceCharge: ChargeState
  gst: ChargeState
  receiptTotalInput: string
}

type ReceiptStoreActions = {
  // UI actions (from receiptUiStore)
  setUxMode: (next: 'simple' | 'advanced') => void
  setPeopleInput: (next: string) => void
  setGeminiApiKeyInput: (next: string) => void
  setRememberGeminiApiKey: (next: boolean) => void
  setGeminiModel: (next: string) => void
  setReceiptFile: (next: File | null) => void
  setScanStatus: (next: SetStateAction<string>) => void
  setScanError: (next: SetStateAction<string | null>) => void
  setScanWarnings: (next: SetStateAction<string[]>) => void
  clearScanFeedback: () => void
  startScan: () => void
  advanceLoadingMessage: () => void
  finishScan: () => void
  setShowApiKeyModal: (show: boolean) => void

  // Workspace actions (from receiptWorkspaceStore)
  initialize: (uxMode: 'simple' | 'advanced') => void
  reset: () => void
  addPeopleFromInput: (rawInput: string) => void
  removePerson: (personId: string) => void
  addAdvancedItem: () => void
  addSimpleItem: () => void
  removeItem: (itemId: string) => void
  updateItem: (itemId: string, updater: (item: EditableItem) => EditableItem) => void
  setDiscount: (next: ChargeState) => void
  setServiceCharge: (next: ChargeState) => void
  setGst: (next: ChargeState) => void
  setReceiptTotalInput: (value: string) => void
  normalizeItemsForSimpleMode: () => void
  handleReceiptFileSelected: (file: File | null) => void
  handleScanReceipt: () => Promise<void>
  handleLoadMockReceipt: () => void
  handleLoadSimpleMockReceipt: () => void
  getExportJson: () => string
  importFromJson: (raw: string) => void
}

type ReceiptStore = ReceiptStoreState & ReceiptStoreActions

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialGeminiApiKey = loadInitialGeminiApiKey()

const initialState: ReceiptStoreState = {
  // UI state
  uxMode: loadPersistedUxMode(),
  peopleInput: '',
  geminiApiKeyInput: initialGeminiApiKey,
  rememberGeminiApiKey: initialGeminiApiKey.trim().length > 0,
  geminiModel: loadInitialGeminiModel(),
  receiptFile: null,
  isScanning: false,
  scanStatus: '',
  scanError: null,
  scanWarnings: [],
  loadingMessage: '',
  loadingMessageIndex: 0,
  showApiKeyModal: false,

  // Workspace state
  initialized: false,
  people: [],
  items: [],
  discount: defaultDiscountState,
  serviceCharge: defaultServiceChargeState,
  gst: defaultGstState,
  receiptTotalInput: '',
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useReceiptStore = create<ReceiptStore>((set, get) => ({
  ...initialState,

  // --- UI actions ---

  setUxMode: (next) => {
    savePersistedUxMode(next)
    set({ uxMode: next })
  },
  setPeopleInput: (next) => set({ peopleInput: next }),
  setGeminiApiKeyInput: (next) =>
    set((state) => {
      syncGeminiApiKeyPersistence(next, state.rememberGeminiApiKey)
      return { geminiApiKeyInput: next }
    }),
  setRememberGeminiApiKey: (next) =>
    set((state) => {
      syncGeminiApiKeyPersistence(state.geminiApiKeyInput, next)
      return { rememberGeminiApiKey: next }
    }),
  setGeminiModel: (next) => {
    const normalizedModel = normalizeGeminiModel(next)
    savePersistedOcrSettings({
      version: 1,
      geminiModel: normalizedModel,
      savedAt: new Date().toISOString(),
    })
    set({ geminiModel: normalizedModel })
  },
  setReceiptFile: (next) => set({ receiptFile: next }),
  setScanStatus: (next) =>
    set((state) => ({ scanStatus: resolveSetStateAction(state.scanStatus, next) })),
  setScanError: (next) =>
    set((state) => ({ scanError: resolveSetStateAction(state.scanError, next) })),
  setScanWarnings: (next) =>
    set((state) => ({ scanWarnings: resolveSetStateAction(state.scanWarnings, next) })),
  clearScanFeedback: () =>
    set({
      scanStatus: '',
      scanError: null,
      scanWarnings: [],
      loadingMessage: '',
      loadingMessageIndex: 0,
    }),
  startScan: () =>
    set(() => {
      const nextIndex = getRandomLoadingMessageIndex()
      return {
        isScanning: true,
        scanStatus: 'Preparing Gemini request...',
        scanError: null,
        scanWarnings: [],
        loadingMessage: FUNNY_LOADING_MESSAGES[nextIndex],
        loadingMessageIndex: nextIndex,
      }
    }),
  advanceLoadingMessage: () =>
    set((state) => {
      const nextIndex = getRandomLoadingMessageIndex(state.loadingMessageIndex)
      return {
        loadingMessageIndex: nextIndex,
        loadingMessage: FUNNY_LOADING_MESSAGES[nextIndex],
      }
    }),
  finishScan: () =>
    set({
      isScanning: false,
      scanStatus: '',
      loadingMessage: '',
      loadingMessageIndex: 0,
    }),
  setShowApiKeyModal: (show) => set({ showApiKeyModal: show }),

  // --- Workspace actions ---

  initialize: (uxMode) => {
    if (get().initialized) {
      return
    }

    const draft = loadPersistedDraft()
    const initialPeople = draft?.people ?? []
    const initialItems = buildInitialItems(draft?.items ?? [], initialPeople, uxMode)
    set({
      initialized: true,
      people: initialPeople,
      items: initialItems,
      discount: draft?.discount ?? defaultDiscountState,
      serviceCharge: draft?.serviceCharge ?? defaultServiceChargeState,
      gst: draft?.gst ?? defaultGstState,
      receiptTotalInput: draft?.receiptTotalInput ?? '',
    })
  },
  reset: () => {
    set({
      initialized: false,
      people: [],
      items: [],
      discount: defaultDiscountState,
      serviceCharge: defaultServiceChargeState,
      gst: defaultGstState,
      receiptTotalInput: '',
    })
  },
  addPeopleFromInput: (rawInput) => {
    const { uxMode } = get()
    const nextNames = rawInput
      .split(/[\n,]+/)
      .map((name) => name.trim())
      .filter((name) => name.length > 0)

    if (nextNames.length === 0) {
      return
    }

    set((state) => {
      const existing = new Set(state.people.map((person) => person.name.toLowerCase()))
      const additions = nextNames
        .filter((name) => !existing.has(name.toLowerCase()))
        .map((name) => ({ id: createId(), name }))

      if (additions.length === 0) {
        return state
      }

      const people = [...state.people, ...additions]
      return {
        ...state,
        people,
        items: syncItemsWithPeople(state.items, people, uxMode),
      }
    })

    set({ peopleInput: '' })
  },
  removePerson: (personId) => {
    const { uxMode } = get()
    set((state) => {
      const people = state.people.filter((person) => person.id !== personId)
      return {
        ...state,
        people,
        items: syncItemsWithPeople(state.items, people, uxMode),
      }
    })
  },
  addAdvancedItem: () => {
    set((state) => ({
      ...state,
      items: [...state.items, createEmptyItem(state.people)],
    }))
  },
  addSimpleItem: () => {
    set((state) => ({
      ...state,
      items: [...state.items, createSimpleEmptyItem(state.people)],
    }))
  },
  removeItem: (itemId) => {
    set((state) => {
      if (state.items.length <= 1) {
        return state
      }
      return {
        ...state,
        items: state.items.filter((item) => item.id !== itemId),
      }
    })
  },
  updateItem: (itemId, updater) => {
    set((state) => ({
      ...state,
      items: state.items.map((item) => (item.id === itemId ? updater(item) : item)),
    }))
  },
  setDiscount: (next) => set({ discount: next }),
  setServiceCharge: (next) => set({ serviceCharge: next }),
  setGst: (next) => set({ gst: next }),
  setReceiptTotalInput: (value) => set({ receiptTotalInput: value }),
  normalizeItemsForSimpleMode: () => {
    set((state) => ({
      ...state,
      items: convertItemsToSimpleEqualMode(state.items, state.people),
    }))
  },
  handleReceiptFileSelected: (file) => {
    if (file) {
      const uxMode = get().uxMode
      set((state) => ({
        ...state,
        items: [uxMode === 'simple' ? createSimpleEmptyItem(state.people) : createEmptyItem(state.people)],
        discount: defaultDiscountState,
        serviceCharge: defaultServiceChargeState,
        gst: defaultGstState,
        receiptTotalInput: '',
      }))
      clearPersistedDraft()
    }
    set({
      receiptFile: file,
      scanStatus: '',
      scanError: null,
      scanWarnings: [],
      loadingMessage: '',
      loadingMessageIndex: 0,
    })
  },
  handleScanReceipt: async () => {
    const { receiptFile, geminiApiKeyInput, geminiModel, uxMode } = get()

    if (!receiptFile) {
      return
    }

    if (!geminiApiKeyInput.trim()) {
      set({ scanError: 'Missing Gemini API key. Enter it above.' })
      return
    }

    // Inline startScan
    const nextIndex = getRandomLoadingMessageIndex()
    set({
      isScanning: true,
      scanStatus: 'Preparing Gemini request...',
      scanError: null,
      scanWarnings: [],
      loadingMessage: FUNNY_LOADING_MESSAGES[nextIndex],
      loadingMessageIndex: nextIndex,
    })

    try {
      const payload = await analyzeReceiptWithGemini(
        receiptFile,
        geminiApiKeyInput,
        geminiModel,
        get().setScanStatus,
      )
      const { people } = get()
      applyOcrPayload(
        payload,
        people,
        (updater) => {
          set((state) => ({
            ...state,
            items: typeof updater === 'function' ? updater(state.items) : updater,
          }))
        },
        (next) =>
          set((state) => ({
            ...state,
            serviceCharge: resolveSetStateAction(state.serviceCharge, next),
          })),
        (next) =>
          set((state) => ({
            ...state,
            gst: resolveSetStateAction(state.gst, next),
          })),
        get().setScanWarnings,
        (value) =>
          set((state) => ({
            ...state,
            receiptTotalInput: resolveSetStateAction(state.receiptTotalInput, value),
          })),
      )
      if (uxMode === 'simple') {
        set((state) => ({
          ...state,
          items: convertItemsToSimpleEqualMode(state.items, state.people),
        }))
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to scan receipt'
      set({ scanError: message })
    } finally {
      // Inline finishScan
      set({
        isScanning: false,
        scanStatus: '',
        loadingMessage: '',
        loadingMessageIndex: 0,
      })
    }
  },
  handleLoadMockReceipt: () => {
    const { uxMode } = get()
    // Inline clearScanFeedback
    set({
      scanStatus: '',
      scanError: null,
      scanWarnings: [],
      loadingMessage: '',
      loadingMessageIndex: 0,
    })
    const payload = buildLocalMockOcrResponse('Loaded local mock receipt data.')
    const mockPeople = [
      { id: createId(), name: 'Alice' },
      { id: createId(), name: 'Bob' },
      { id: createId(), name: 'Charlie' },
    ]
    set((state) => ({ ...state, people: mockPeople }))
    applyOcrPayload(
      payload,
      mockPeople,
      (updater) => {
        set((state) => ({
          ...state,
          items: typeof updater === 'function' ? updater(state.items) : updater,
        }))
      },
      (next) =>
        set((state) => ({
          ...state,
          serviceCharge: resolveSetStateAction(state.serviceCharge, next),
        })),
      (next) =>
        set((state) => ({
          ...state,
          gst: resolveSetStateAction(state.gst, next),
        })),
      get().setScanWarnings,
      (value) =>
        set((state) => ({
          ...state,
          receiptTotalInput: resolveSetStateAction(state.receiptTotalInput, value),
        })),
    )
    if (uxMode === 'simple') {
      set((state) => ({
        ...state,
        items: convertItemsToSimpleEqualMode(state.items, state.people),
      }))
    }
  },
  handleLoadSimpleMockReceipt: () => {
    // Inline clearScanFeedback
    set({
      scanStatus: '',
      scanError: null,
      scanWarnings: [],
      loadingMessage: '',
      loadingMessageIndex: 0,
    })
    const payload = buildSimpleModeMockOcrResponse()
    const mockPeople = [
      { id: createId(), name: 'Alice' },
      { id: createId(), name: 'Bob' },
      { id: createId(), name: 'Charlie' },
      { id: createId(), name: 'David' },
    ]
    set((state) => ({ ...state, people: mockPeople }))
    applyOcrPayload(
      payload,
      mockPeople,
      (updater) => {
        set((state) => ({
          ...state,
          items: typeof updater === 'function' ? updater(state.items) : updater,
        }))
      },
      (next) =>
        set((state) => ({
          ...state,
          serviceCharge: resolveSetStateAction(state.serviceCharge, next),
        })),
      (next) =>
        set((state) => ({
          ...state,
          gst: resolveSetStateAction(state.gst, next),
        })),
      get().setScanWarnings,
      (value) =>
        set((state) => ({
          ...state,
          receiptTotalInput: resolveSetStateAction(state.receiptTotalInput, value),
        })),
    )
    set((state) => ({
      ...state,
      items: convertItemsToSimpleEqualMode(state.items, state.people),
    }))
  },
  getExportJson: () => {
    const { people, items, discount, serviceCharge, gst, receiptTotalInput } = get()
    return exportDraftToJson({ people, items, discount, serviceCharge, gst, receiptTotalInput })
  },
  importFromJson: (raw) => {
    const draft = importDraftFromJson(raw)
    if (!draft) {
      return
    }
    const { uxMode } = get()
    set({
      people: draft.people,
      items: buildInitialItems(draft.items, draft.people, uxMode),
      discount: draft.discount,
      serviceCharge: draft.serviceCharge,
      gst: draft.gst,
      receiptTotalInput: draft.receiptTotalInput,
    })
  },
}))
