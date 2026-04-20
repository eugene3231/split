import type { SetStateAction } from 'react';
import { create } from 'zustand';
import { FUNNY_LOADING_MESSAGES, getRandomLoadingMessageIndex } from '../logic/loadingMessages';

export type ReceiptScanState = {
  isScanning: boolean;
  scanStatus: string;
  scanError: string | null;
  scanWarnings: string[];
  loadingMessage: string;
  loadingMessageIndex: number;
};

export const defaultScanState: ReceiptScanState = {
  isScanning: false,
  scanStatus: '',
  scanError: null,
  scanWarnings: [],
  loadingMessage: '',
  loadingMessageIndex: 0,
};

export function getScanState(
  scanStateByReceipt: Record<string, ReceiptScanState>,
  receiptId: string,
): ReceiptScanState {
  return scanStateByReceipt[receiptId] ?? defaultScanState;
}

function updateScanState(
  scanStateByReceipt: Record<string, ReceiptScanState>,
  receiptId: string,
  patch: Partial<ReceiptScanState>,
): Record<string, ReceiptScanState> {
  return {
    ...scanStateByReceipt,
    [receiptId]: { ...getScanState(scanStateByReceipt, receiptId), ...patch },
  };
}

function resolveSetStateAction<T>(current: T, next: SetStateAction<T>): T {
  return typeof next === 'function' ? (next as (prev: T) => T)(current) : next;
}

type ScanStore = {
  scanStateByReceipt: Record<string, ReceiptScanState>;
  setScanStatus: (receiptId: string, next: SetStateAction<string>) => void;
  setScanError: (receiptId: string, next: SetStateAction<string | null>) => void;
  setScanWarnings: (receiptId: string, next: SetStateAction<string[]>) => void;
  clearScanFeedback: (receiptId: string) => void;
  startScan: (receiptId: string) => void;
  advanceLoadingMessage: () => void;
  finishScan: (receiptId: string) => void;
  resetScanStates: () => void;
};

export const useScanStore = create<ScanStore>((set) => ({
  scanStateByReceipt: {},

  setScanStatus: (receiptId, next) =>
    set((state) => {
      const current = getScanState(state.scanStateByReceipt, receiptId);
      return {
        scanStateByReceipt: updateScanState(state.scanStateByReceipt, receiptId, {
          scanStatus: resolveSetStateAction(current.scanStatus, next),
        }),
      };
    }),

  setScanError: (receiptId, next) =>
    set((state) => {
      const current = getScanState(state.scanStateByReceipt, receiptId);
      return {
        scanStateByReceipt: updateScanState(state.scanStateByReceipt, receiptId, {
          scanError: resolveSetStateAction(current.scanError, next),
        }),
      };
    }),

  setScanWarnings: (receiptId, next) =>
    set((state) => {
      const current = getScanState(state.scanStateByReceipt, receiptId);
      return {
        scanStateByReceipt: updateScanState(state.scanStateByReceipt, receiptId, {
          scanWarnings: resolveSetStateAction(current.scanWarnings, next),
        }),
      };
    }),

  clearScanFeedback: (receiptId) =>
    set((state) => ({
      scanStateByReceipt: updateScanState(state.scanStateByReceipt, receiptId, {
        scanStatus: '',
        scanError: null,
        scanWarnings: [],
        loadingMessage: '',
        loadingMessageIndex: 0,
      }),
    })),

  startScan: (receiptId) =>
    set((state) => {
      const nextIndex = getRandomLoadingMessageIndex();
      return {
        scanStateByReceipt: updateScanState(state.scanStateByReceipt, receiptId, {
          isScanning: true,
          scanStatus: 'Preparing Gemini request...',
          scanError: null,
          scanWarnings: [],
          loadingMessage: FUNNY_LOADING_MESSAGES[nextIndex],
          loadingMessageIndex: nextIndex,
        }),
      };
    }),

  advanceLoadingMessage: () =>
    set((state) => {
      const next = { ...state.scanStateByReceipt };
      for (const [id, s] of Object.entries(next)) {
        if (s.isScanning) {
          const nextIndex = getRandomLoadingMessageIndex(s.loadingMessageIndex);
          next[id] = {
            ...s,
            loadingMessageIndex: nextIndex,
            loadingMessage: FUNNY_LOADING_MESSAGES[nextIndex],
          };
        }
      }
      return { scanStateByReceipt: next };
    }),

  finishScan: (receiptId) =>
    set((state) => ({
      scanStateByReceipt: updateScanState(state.scanStateByReceipt, receiptId, {
        isScanning: false,
        scanStatus: '',
        loadingMessage: '',
        loadingMessageIndex: 0,
      }),
    })),

  resetScanStates: () => set({ scanStateByReceipt: {} }),
}));
