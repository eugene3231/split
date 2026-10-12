import { create } from 'zustand';
import { FUNNY_LOADING_MESSAGES, getRandomLoadingMessageIndex } from '../logic/loadingMessages';

export type ReceiptScanState = {
  isScanning: boolean;
  scanError: string | null;
  scanWarnings: string[];
  loadingMessage: string;
  loadingMessageIndex: number;
};

const defaultScanState: ReceiptScanState = {
  isScanning: false,
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

type ScanStore = {
  scanStateByReceipt: Record<string, ReceiptScanState>;
  setScanError: (receiptId: string, scanError: string | null) => void;
  setScanWarnings: (receiptId: string, scanWarnings: string[]) => void;
  clearScanFeedback: (receiptId: string) => void;
  startScan: (receiptId: string) => void;
  advanceLoadingMessage: () => void;
  finishScan: (receiptId: string) => void;
  resetScanStates: () => void;
};

export const useScanStore = create<ScanStore>((set) => ({
  scanStateByReceipt: {},

  setScanError: (receiptId, scanError) =>
    set((state) => ({
      scanStateByReceipt: updateScanState(state.scanStateByReceipt, receiptId, { scanError }),
    })),

  // Nothing shows these yet: how to surface scan warnings is still to be designed.
  setScanWarnings: (receiptId, scanWarnings) =>
    set((state) => ({
      scanStateByReceipt: updateScanState(state.scanStateByReceipt, receiptId, { scanWarnings }),
    })),

  clearScanFeedback: (receiptId) =>
    set((state) => ({
      scanStateByReceipt: updateScanState(state.scanStateByReceipt, receiptId, {
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
        loadingMessage: '',
        loadingMessageIndex: 0,
      }),
    })),

  resetScanStates: () => set({ scanStateByReceipt: {} }),
}));
