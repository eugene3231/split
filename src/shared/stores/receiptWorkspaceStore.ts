import { create } from 'zustand'
import { defaultDiscountState, defaultGstState, defaultServiceChargeState } from '../constants'
import {
  clearPersistedDraft,
  exportDraftToJson,
  importDraftFromJson,
  loadPersistedDraft,
} from '../api/storage'
import { createEmptyItem, sanitizeItemAssignment } from '../logic/assignment/items'
import { createId } from '../logic/core/id'
import type { ChargeState, EditableItem, Person } from '../types'
import { useReceiptUiStore } from './receiptUiStore'
import {
  analyzeReceiptWithGemini,
  applyOcrPayload,
  buildLocalMockOcrResponse,
  buildSimpleModeMockOcrResponse,
} from '../../features/receipt-scanner'
import { buildNewSimpleItem, convertItemsToSimpleEqualMode } from '../logic/simpleAssignments'

type ReceiptWorkspaceState = {
  initialized: boolean
  people: Person[]
  items: EditableItem[]
  discount: ChargeState
  serviceCharge: ChargeState
  gst: ChargeState
  receiptTotalInput: string
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

export const useReceiptWorkspaceStore = create<ReceiptWorkspaceState>((set, get) => ({
  initialized: false,
  people: [],
  items: [],
  discount: defaultDiscountState,
  serviceCharge: defaultServiceChargeState,
  gst: defaultGstState,
  receiptTotalInput: '',
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
    const uxMode = useReceiptUiStore.getState().uxMode
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

    useReceiptUiStore.getState().setPeopleInput('')
  },
  removePerson: (personId) => {
    const uxMode = useReceiptUiStore.getState().uxMode
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
      items: [...state.items, buildNewSimpleItem(state.people)],
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
  setDiscount: (next) => {
    set((state) => ({ ...state, discount: next }))
  },
  setServiceCharge: (next) => {
    set((state) => ({ ...state, serviceCharge: next }))
  },
  setGst: (next) => {
    set((state) => ({ ...state, gst: next }))
  },
  setReceiptTotalInput: (value) => {
    set((state) => ({ ...state, receiptTotalInput: value }))
  },
  normalizeItemsForSimpleMode: () => {
    set((state) => ({
      ...state,
      items: convertItemsToSimpleEqualMode(state.items, state.people),
    }))
  },
  handleReceiptFileSelected: (file) => {
    const uiState = useReceiptUiStore.getState()
    if (file) {
      const uxMode = uiState.uxMode
      set((state) => ({
        ...state,
        items: [uxMode === 'simple' ? buildNewSimpleItem(state.people) : createEmptyItem(state.people)],
        discount: defaultDiscountState,
        serviceCharge: defaultServiceChargeState,
        gst: defaultGstState,
        receiptTotalInput: '',
      }))
      clearPersistedDraft()
    }
    uiState.clearScanFeedback()
    uiState.setReceiptFile(file)
  },
  handleScanReceipt: async () => {
    const uiState = useReceiptUiStore.getState()
    if (!uiState.receiptFile) {
      return
    }

    if (!uiState.geminiApiKeyInput.trim()) {
      uiState.setScanError('Missing Gemini API key. Enter it above.')
      return
    }

    uiState.startScan()

    try {
      const payload = await analyzeReceiptWithGemini(
        uiState.receiptFile,
        uiState.geminiApiKeyInput,
        uiState.geminiModel,
        uiState.setScanStatus,
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
            serviceCharge: resolveSetStateAction(next, state.serviceCharge),
          })),
        (next) =>
          set((state) => ({
            ...state,
            gst: resolveSetStateAction(next, state.gst),
          })),
        uiState.setScanWarnings,
        (value) =>
          set((state) => ({
            ...state,
            receiptTotalInput: resolveSetStateAction(value, state.receiptTotalInput),
          })),
      )
      if (uiState.uxMode === 'simple') {
        set((state) => ({
          ...state,
          items: convertItemsToSimpleEqualMode(state.items, state.people),
        }))
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to scan receipt'
      uiState.setScanError(message)
    } finally {
      uiState.finishScan()
    }
  },
  handleLoadMockReceipt: () => {
    const uiState = useReceiptUiStore.getState()
    uiState.clearScanFeedback()
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
          serviceCharge: resolveSetStateAction(next, state.serviceCharge),
        })),
      (next) =>
        set((state) => ({
          ...state,
          gst: resolveSetStateAction(next, state.gst),
        })),
      uiState.setScanWarnings,
      (value) =>
        set((state) => ({
          ...state,
          receiptTotalInput: resolveSetStateAction(value, state.receiptTotalInput),
        })),
    )
    if (uiState.uxMode === 'simple') {
      set((state) => ({
        ...state,
        items: convertItemsToSimpleEqualMode(state.items, state.people),
      }))
    }
  },
  handleLoadSimpleMockReceipt: () => {
    const uiState = useReceiptUiStore.getState()
    uiState.clearScanFeedback()
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
          serviceCharge: resolveSetStateAction(next, state.serviceCharge),
        })),
      (next) =>
        set((state) => ({
          ...state,
          gst: resolveSetStateAction(next, state.gst),
        })),
      uiState.setScanWarnings,
      (value) =>
        set((state) => ({
          ...state,
          receiptTotalInput: resolveSetStateAction(value, state.receiptTotalInput),
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
    const uxMode = useReceiptUiStore.getState().uxMode
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

function resolveSetStateAction<T>(next: T | ((current: T) => T), current: T): T {
  return typeof next === 'function' ? (next as (value: T) => T)(current) : next
}
