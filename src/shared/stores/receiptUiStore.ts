import type { SetStateAction } from 'react'
import { create } from 'zustand'
import { DEFAULT_GEMINI_MODEL, GEMINI_MODELS, LOCAL_STORAGE_UX_MODE_KEY } from '../constants'
import {
  clearSessionGeminiApiKey,
  loadPersistedOcrSettings,
  loadSessionGeminiApiKey,
  savePersistedOcrSettings,
  saveSessionGeminiApiKey,
} from '../api/storage'

const FUNNY_LOADING_MESSAGES = [
  'Asking Gemini to decipher cryptic cashier handwriting...',
  'Negotiating with suspiciously smudged totals...',
  'Politely requesting line items to stand in a straight line...',
  'Convincing decimals to stay exactly where they belong...',
  'Scanning for rogue service charge surprises...',
  'Calibrating neural napkin math...',
  'Bribing OCR goblins with synthetic compliments...',
  'Running a tiny committee of transformer experts...',
  'Summoning receipts from the shadow realm of camera blur...',
  'Translating cashier hieroglyphics into plain numbers...',
  'Asking the model to stop hallucinating extra appetizers...',
  'Teaching tokenizers the difference between 8 and B...',
  'Sending a polite ping to the cloud brain trust...',
  'Checking whether that total includes emotional damage...',
  'Aligning subtotal chakras with tax reality...',
  'Convincing entropy to format currency correctly...',
  'Cross-examining every item like an AI detective...',
  'Turning pixel soup into itemized truth...',
  'Computing split fairness with excessive machine confidence...',
  'Waiting for the model to finish its dramatic pause...',
] as const

function getRandomLoadingMessageIndex(excludeIndex?: number): number {
  const messageCount = FUNNY_LOADING_MESSAGES.length
  if (messageCount <= 1) return 0

  if (excludeIndex === undefined || excludeIndex < 0 || excludeIndex >= messageCount) {
    return Math.floor(Math.random() * messageCount)
  }

  // Pick any other message index to avoid immediate repeats.
  const offset = Math.floor(Math.random() * (messageCount - 1)) + 1
  return (excludeIndex + offset) % messageCount
}

type ReceiptUiState = {
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
}

type ReceiptUiActions = {
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
}

type ReceiptUiStore = ReceiptUiState & ReceiptUiActions
const initialGeminiApiKey = loadInitialGeminiApiKey()

const initialState: ReceiptUiState = {
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
}

function resolveSetStateAction<T>(current: T, next: SetStateAction<T>): T {
  return typeof next === 'function' ? (next as (previous: T) => T)(current) : next
}

function loadPersistedUxMode(): 'simple' | 'advanced' {
  if (typeof window === 'undefined') {
    return 'simple'
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_UX_MODE_KEY)
    if (raw === 'advanced') {
      return 'advanced'
    }
  } catch {
    // Ignore storage read failures.
  }

  return 'simple'
}

function savePersistedUxMode(mode: 'simple' | 'advanced'): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(LOCAL_STORAGE_UX_MODE_KEY, mode)
  } catch {
    // Ignore storage write failures.
  }
}

function normalizeGeminiModel(candidate: string): string {
  return GEMINI_MODELS.includes(candidate as (typeof GEMINI_MODELS)[number])
    ? candidate
    : DEFAULT_GEMINI_MODEL
}

function loadInitialGeminiModel(): string {
  const persistedSettings = loadPersistedOcrSettings()
  return normalizeGeminiModel(persistedSettings?.geminiModel ?? DEFAULT_GEMINI_MODEL)
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

export const useReceiptUiStore = create<ReceiptUiStore>((set) => ({
  ...initialState,
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
  setScanError: (next) => set((state) => ({ scanError: resolveSetStateAction(state.scanError, next) })),
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
}))
