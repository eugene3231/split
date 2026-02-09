import type { SetStateAction } from 'react'
import { create } from 'zustand'
import { DEFAULT_GEMINI_MODEL } from '../constants'

const FUNNY_LOADING_MESSAGES = [
  'Asking Gemini to decipher cryptic cashier handwriting...',
  'Negotiating with suspiciously smudged totals...',
  'Politely requesting line items to stand in a straight line...',
  'Convincing decimals to stay exactly where they belong...',
  'Scanning for rogue service charge surprises...',
] as const

type ReceiptUiState = {
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

const initialState: ReceiptUiState = {
  peopleInput: '',
  geminiApiKeyInput: '',
  rememberGeminiApiKey: false,
  geminiModel: DEFAULT_GEMINI_MODEL,
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

export const useReceiptUiStore = create<ReceiptUiStore>((set) => ({
  ...initialState,
  setPeopleInput: (next) => set({ peopleInput: next }),
  setGeminiApiKeyInput: (next) => set({ geminiApiKeyInput: next }),
  setRememberGeminiApiKey: (next) => set({ rememberGeminiApiKey: next }),
  setGeminiModel: (next) => set({ geminiModel: next }),
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
    set({
      isScanning: true,
      scanStatus: 'Preparing Gemini request...',
      scanError: null,
      scanWarnings: [],
      loadingMessage: FUNNY_LOADING_MESSAGES[0],
      loadingMessageIndex: 0,
    }),
  advanceLoadingMessage: () =>
    set((state) => {
      const nextIndex = (state.loadingMessageIndex + 1) % FUNNY_LOADING_MESSAGES.length
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
