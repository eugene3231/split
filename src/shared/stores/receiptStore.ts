import type { Dispatch, SetStateAction } from 'react';
import { create } from 'zustand';
import {
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '@shared/constants';
import {
  clearSessionGeminiApiKey,
  exportDraftToJson,
  importDraftFromJson,
  loadExchangeRates,
  loadPersistedDraft,
  loadPersistedOcrSettings,
  loadPersistedUxMode,
  loadSessionGeminiApiKey,
  saveExchangeRates,
  savePersistedOcrSettings,
  savePersistedUxMode,
  saveSessionGeminiApiKey,
} from '@shared/api/storage';
import { fetchExchangeRates } from '@shared/api/exchangeRateApi';
import { FALLBACK_RATES_TO_SGD, BASE_CURRENCY } from '@shared/constants';
import { createEmptyItem } from '@shared/logic/assignment/items';
import { createId } from '@shared/logic/core/id';
import { normalizeGeminiModel } from '@shared/logic/core/geminiModel';
import {
  FUNNY_LOADING_MESSAGES,
  getRandomLoadingMessageIndex,
} from '@shared/logic/core/loadingMessages';
import type { ChargeState, EditableItem, OcrResponse, Person, Receipt } from '@shared/types';
import { analyzeReceiptWithGemini, applyOcrPayload } from '@features/receipt-scanner';
import { MOCK_RECEIPT_FIXTURES } from '@features/receipt-scanner/logic/ocrFixtures';
import {
  buildInitialItems,
  createSimpleEmptyItem,
  convertItemsToSimpleEqualMode,
  syncItemsWithPeople,
} from '@shared/logic/assignment/simpleAssignments';

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

function loadInitialGeminiModel(): string {
  const persistedSettings = loadPersistedOcrSettings();
  return normalizeGeminiModel(persistedSettings?.geminiModel ?? '');
}

function loadInitialGeminiApiKey(): string {
  return loadSessionGeminiApiKey();
}

function syncGeminiApiKeyPersistence(apiKey: string, rememberApiKey: boolean): void {
  if (rememberApiKey && apiKey.trim()) {
    saveSessionGeminiApiKey(apiKey);
    return;
  }

  clearSessionGeminiApiKey();
}

function resolveSetStateAction<T>(current: T, next: SetStateAction<T>): T {
  return typeof next === 'function' ? (next as (previous: T) => T)(current) : next;
}

function createBlankReceipt(
  people: Person[],
  uxMode: 'simple' | 'advanced',
  name: string,
): Receipt {
  return {
    id: createId(),
    name,
    items: [uxMode === 'simple' ? createSimpleEmptyItem(people) : createEmptyItem(people)],
    discount: { ...defaultDiscountState },
    serviceCharge: { ...defaultServiceChargeState },
    gst: { ...defaultGstState },
    receiptTotalInput: '',
    currency: BASE_CURRENCY,
    exchangeRateOverride: null,
  };
}

// ---------------------------------------------------------------------------
// Combined store type
// ---------------------------------------------------------------------------

type ReceiptScanState = {
  isScanning: boolean;
  scanStatus: string;
  scanError: string | null;
  scanWarnings: string[];
  loadingMessage: string;
  loadingMessageIndex: number;
};

const defaultScanState: ReceiptScanState = {
  isScanning: false,
  scanStatus: '',
  scanError: null,
  scanWarnings: [],
  loadingMessage: '',
  loadingMessageIndex: 0,
};

function getScanState(
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

type ReceiptStoreState = {
  // UI state
  uxMode: 'simple' | 'advanced';
  peopleInput: string;
  geminiApiKeyInput: string;
  rememberGeminiApiKey: boolean;
  geminiModel: string;
  scanStateByReceipt: Record<string, ReceiptScanState>;
  showApiKeyModal: boolean;

  // Workspace state
  initialized: boolean;
  people: Person[];
  receipts: Receipt[];
  activeReceiptId: string;

  // Exchange rates
  exchangeRates: Record<string, number>;
  exchangeRatesLastFetched: number | null;
};

type ReceiptStoreActions = {
  // UI actions
  setUxMode: (next: 'simple' | 'advanced') => void;
  setPeopleInput: (next: string) => void;
  setGeminiApiKeyInput: (next: string) => void;
  setRememberGeminiApiKey: (next: boolean) => void;
  setGeminiModel: (next: string) => void;
  setScanStatus: (receiptId: string, next: SetStateAction<string>) => void;
  setScanError: (receiptId: string, next: SetStateAction<string | null>) => void;
  setScanWarnings: (receiptId: string, next: SetStateAction<string[]>) => void;
  clearScanFeedback: (receiptId: string) => void;
  startScan: (receiptId: string) => void;
  advanceLoadingMessage: () => void;
  finishScan: (receiptId: string) => void;
  setShowApiKeyModal: (show: boolean) => void;

  // Workspace actions
  initialize: (uxMode: 'simple' | 'advanced') => void;
  reset: () => void;
  addPeopleFromInput: (rawInput: string) => void;
  removePerson: (personId: string) => void;
  addAdvancedItem: () => void;
  addSimpleItem: () => void;
  removeItem: (itemId: string) => void;
  updateItem: (itemId: string, updater: (item: EditableItem) => EditableItem) => void;
  setDiscount: (next: ChargeState) => void;
  setServiceCharge: (next: ChargeState) => void;
  setGst: (next: ChargeState) => void;
  setReceiptTotalInput: (value: string) => void;
  normalizeItemsForSimpleMode: () => void;
  handleReceiptFileSelected: (file: File | null) => void;
  handleScanReceipt: () => Promise<void>;
  handleLoadMockReceipt: (index: number) => void;
  handleLoadMockWorkspace: () => void;
  applyMockToCurrentReceipt: (index: number) => void;
  getExportJson: () => string;
  importFromJson: (raw: string) => void;

  // Receipt management actions
  addReceipt: () => void;
  removeReceipt: (receiptId: string) => void;
  setActiveReceiptId: (receiptId: string) => void;
  renameReceipt: (receiptId: string, name: string) => void;

  // Currency actions
  setReceiptCurrency: (receiptId: string, currency: string) => void;
  setReceiptExchangeRateOverride: (receiptId: string, rate: number | null) => void;
  fetchAndSetExchangeRates: () => Promise<void>;
};

type ReceiptStore = ReceiptStoreState & ReceiptStoreActions;

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialGeminiApiKey = loadInitialGeminiApiKey();

const initialState: ReceiptStoreState = {
  // UI state
  uxMode: loadPersistedUxMode(),
  peopleInput: '',
  geminiApiKeyInput: initialGeminiApiKey,
  rememberGeminiApiKey: initialGeminiApiKey.trim().length > 0,
  geminiModel: loadInitialGeminiModel(),
  scanStateByReceipt: {},
  showApiKeyModal: false,

  // Workspace state
  initialized: false,
  people: [],
  receipts: [],
  activeReceiptId: '',

  // Exchange rates (loaded from localStorage or fallback)
  exchangeRates: loadExchangeRates() ?? FALLBACK_RATES_TO_SGD,
  exchangeRatesLastFetched: null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useReceiptStore = create<ReceiptStore>((set, get) => {
  function applyPayloadToReceipt(
    payload: OcrResponse,
    receiptId: string,
    people: Person[],
    uxMode: 'simple' | 'advanced',
    setScanWarnings: Dispatch<SetStateAction<string[]>> = () => {},
  ) {
    applyOcrPayload(
      payload,
      people,
      (updater) => {
        set((state) => ({
          receipts: state.receipts.map((r) =>
            r.id === receiptId
              ? { ...r, items: typeof updater === 'function' ? updater(r.items) : updater }
              : r,
          ),
        }));
      },
      (next) => {
        set((state) => ({
          receipts: state.receipts.map((r) =>
            r.id === receiptId
              ? { ...r, serviceCharge: resolveSetStateAction(r.serviceCharge, next) }
              : r,
          ),
        }));
      },
      (next) => {
        set((state) => ({
          receipts: state.receipts.map((r) =>
            r.id === receiptId ? { ...r, gst: resolveSetStateAction(r.gst, next) } : r,
          ),
        }));
      },
      setScanWarnings,
      (value) => {
        set((state) => ({
          receipts: state.receipts.map((r) =>
            r.id === receiptId
              ? { ...r, receiptTotalInput: resolveSetStateAction(r.receiptTotalInput, value) }
              : r,
          ),
        }));
      },
    );
    if (uxMode === 'simple') {
      set((state) => ({
        receipts: state.receipts.map((r) =>
          r.id === receiptId
            ? { ...r, items: convertItemsToSimpleEqualMode(r.items, state.people) }
            : r,
        ),
      }));
    }
  }

  return {
    ...initialState,

    // --- UI actions ---

    setUxMode: (next) => {
      savePersistedUxMode(next);
      set({ uxMode: next });
    },
    setPeopleInput: (next) => set({ peopleInput: next }),
    setGeminiApiKeyInput: (next) =>
      set((state) => {
        syncGeminiApiKeyPersistence(next, state.rememberGeminiApiKey);
        return { geminiApiKeyInput: next };
      }),
    setRememberGeminiApiKey: (next) =>
      set((state) => {
        syncGeminiApiKeyPersistence(state.geminiApiKeyInput, next);
        return { rememberGeminiApiKey: next };
      }),
    setGeminiModel: (next) => {
      const normalizedModel = normalizeGeminiModel(next);
      savePersistedOcrSettings({
        version: 1,
        geminiModel: normalizedModel,
        savedAt: new Date().toISOString(),
      });
      set({ geminiModel: normalizedModel });
    },
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
    setShowApiKeyModal: (show) => set({ showApiKeyModal: show }),

    // --- Workspace actions ---

    initialize: (uxMode) => {
      if (get().initialized) {
        return;
      }

      const draft = loadPersistedDraft();
      if (draft) {
        const receipts = draft.receipts.map((r) => ({
          ...r,
          items: buildInitialItems(r.items, draft.people, uxMode),
        }));
        set({
          initialized: true,
          people: draft.people,
          receipts,
          activeReceiptId: draft.activeReceiptId,
        });
      } else {
        const blankReceipt = createBlankReceipt([], uxMode, 'Receipt 1');
        set({
          initialized: true,
          people: [],
          receipts: [blankReceipt],
          activeReceiptId: blankReceipt.id,
        });
      }
    },
    reset: () => {
      set({
        initialized: false,
        people: [],
        receipts: [],
        activeReceiptId: '',
      });
    },
    addPeopleFromInput: (rawInput) => {
      const { uxMode } = get();
      const nextNames = rawInput
        .split(/[\n,]+/)
        .map((name) => name.trim())
        .filter((name) => name.length > 0);

      if (nextNames.length === 0) {
        return;
      }

      set((state) => {
        const existing = new Set(state.people.map((person) => person.name.toLowerCase()));
        const additions = nextNames
          .filter((name) => !existing.has(name.toLowerCase()))
          .map((name) => ({ id: createId(), name }));

        if (additions.length === 0) {
          return state;
        }

        const people = [...state.people, ...additions];
        return {
          ...state,
          people,
          receipts: state.receipts.map((r) => ({
            ...r,
            items: syncItemsWithPeople(r.items, people, uxMode),
          })),
        };
      });

      set({ peopleInput: '' });
    },
    removePerson: (personId) => {
      const { uxMode } = get();
      set((state) => {
        const people = state.people.filter((person) => person.id !== personId);
        return {
          ...state,
          people,
          receipts: state.receipts.map((r) => ({
            ...r,
            items: syncItemsWithPeople(r.items, people, uxMode),
          })),
        };
      });
    },
    addAdvancedItem: () => {
      set((state) => ({
        receipts: state.receipts.map((r) =>
          r.id === state.activeReceiptId
            ? { ...r, items: [...r.items, createEmptyItem(state.people)] }
            : r,
        ),
      }));
    },
    addSimpleItem: () => {
      set((state) => ({
        receipts: state.receipts.map((r) =>
          r.id === state.activeReceiptId
            ? { ...r, items: [...r.items, createSimpleEmptyItem(state.people)] }
            : r,
        ),
      }));
    },
    removeItem: (itemId) => {
      set((state) => {
        const activeReceipt = state.receipts.find((r) => r.id === state.activeReceiptId);
        if (!activeReceipt || activeReceipt.items.length <= 1) return state;
        return {
          receipts: state.receipts.map((r) =>
            r.id === state.activeReceiptId
              ? { ...r, items: r.items.filter((item) => item.id !== itemId) }
              : r,
          ),
        };
      });
    },
    updateItem: (itemId, updater) => {
      set((state) => ({
        receipts: state.receipts.map((r) =>
          r.id === state.activeReceiptId
            ? { ...r, items: r.items.map((item) => (item.id === itemId ? updater(item) : item)) }
            : r,
        ),
      }));
    },
    setDiscount: (next) => {
      set((state) => ({
        receipts: state.receipts.map((r) =>
          r.id === state.activeReceiptId ? { ...r, discount: next } : r,
        ),
      }));
    },
    setServiceCharge: (next) => {
      set((state) => ({
        receipts: state.receipts.map((r) =>
          r.id === state.activeReceiptId ? { ...r, serviceCharge: next } : r,
        ),
      }));
    },
    setGst: (next) => {
      set((state) => ({
        receipts: state.receipts.map((r) =>
          r.id === state.activeReceiptId ? { ...r, gst: next } : r,
        ),
      }));
    },
    setReceiptTotalInput: (value) => {
      set((state) => ({
        receipts: state.receipts.map((r) =>
          r.id === state.activeReceiptId ? { ...r, receiptTotalInput: value } : r,
        ),
      }));
    },
    normalizeItemsForSimpleMode: () => {
      set((state) => ({
        receipts: state.receipts.map((r) =>
          r.id === state.activeReceiptId
            ? { ...r, items: convertItemsToSimpleEqualMode(r.items, state.people) }
            : r,
        ),
      }));
    },
    handleReceiptFileSelected: (file) => {
      const uxMode = get().uxMode;
      set((state) => ({
        receipts: state.receipts.map((r) =>
          r.id === state.activeReceiptId
            ? {
                ...r,
                receiptFile: file,
                ...(file
                  ? {
                      items: [
                        uxMode === 'simple'
                          ? createSimpleEmptyItem(state.people)
                          : createEmptyItem(state.people),
                      ],
                      discount: { ...defaultDiscountState },
                      serviceCharge: { ...defaultServiceChargeState },
                      gst: { ...defaultGstState },
                      receiptTotalInput: '',
                    }
                  : {}),
              }
            : r,
        ),
        scanStateByReceipt: updateScanState(state.scanStateByReceipt, state.activeReceiptId, {
          scanStatus: '',
          scanError: null,
          scanWarnings: [],
          loadingMessage: '',
          loadingMessageIndex: 0,
        }),
      }));
    },
    handleScanReceipt: async () => {
      const { geminiApiKeyInput, geminiModel, uxMode } = get();
      const scanReceiptId = get().activeReceiptId;
      const activeReceipt = get().receipts.find((r) => r.id === scanReceiptId);
      const receiptFile = activeReceipt?.receiptFile ?? null;

      if (!receiptFile) {
        return;
      }

      if (!geminiApiKeyInput.trim()) {
        set((state) => ({
          scanStateByReceipt: updateScanState(state.scanStateByReceipt, scanReceiptId, {
            scanError: 'Missing Gemini API key. Enter it above.',
          }),
        }));
        return;
      }

      const nextIndex = getRandomLoadingMessageIndex();
      set((state) => ({
        scanStateByReceipt: updateScanState(state.scanStateByReceipt, scanReceiptId, {
          isScanning: true,
          scanStatus: 'Preparing Gemini request...',
          scanError: null,
          scanWarnings: [],
          loadingMessage: FUNNY_LOADING_MESSAGES[nextIndex],
          loadingMessageIndex: nextIndex,
        }),
      }));

      const setScanStatusForReceipt = (next: SetStateAction<string>) =>
        set((state) => {
          const current = getScanState(state.scanStateByReceipt, scanReceiptId);
          return {
            scanStateByReceipt: updateScanState(state.scanStateByReceipt, scanReceiptId, {
              scanStatus: resolveSetStateAction(current.scanStatus, next),
            }),
          };
        });
      const setScanWarningsForReceipt = (next: SetStateAction<string[]>) =>
        set((state) => {
          const current = getScanState(state.scanStateByReceipt, scanReceiptId);
          return {
            scanStateByReceipt: updateScanState(state.scanStateByReceipt, scanReceiptId, {
              scanWarnings: resolveSetStateAction(current.scanWarnings, next),
            }),
          };
        });

      try {
        const payload = await analyzeReceiptWithGemini(
          receiptFile,
          geminiApiKeyInput,
          geminiModel,
          setScanStatusForReceipt,
        );
        const { people } = get();
        applyPayloadToReceipt(payload, scanReceiptId, people, uxMode, setScanWarningsForReceipt);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to scan receipt';
        set((state) => ({
          scanStateByReceipt: updateScanState(state.scanStateByReceipt, scanReceiptId, {
            scanError: message,
          }),
        }));
      } finally {
        set((state) => ({
          scanStateByReceipt: updateScanState(state.scanStateByReceipt, scanReceiptId, {
            isScanning: false,
            scanStatus: '',
            loadingMessage: '',
            loadingMessageIndex: 0,
          }),
        }));
      }
    },
    handleLoadMockReceipt: (index: number) => {
      const fixture = MOCK_RECEIPT_FIXTURES[index];
      if (!fixture) return;
      const { uxMode } = get();
      const payload = fixture.buildResponse();
      const mockPeople = fixture.peopleNames.map((name) => ({ id: createId(), name }));
      const mockReceiptId = createId();
      const mockReceipt = createBlankReceipt(mockPeople, uxMode, 'Receipt 1');
      set({
        people: mockPeople,
        receipts: [{ ...mockReceipt, id: mockReceiptId }],
        activeReceiptId: mockReceiptId,
        scanStateByReceipt: {},
      });
      applyPayloadToReceipt(payload, mockReceiptId, mockPeople, uxMode);
    },
    handleLoadMockWorkspace: () => {
      const { uxMode } = get();
      const people = ['Alice', 'Bob', 'Charlie', 'David'].map((name) => ({ id: createId(), name }));
      const receipts = MOCK_RECEIPT_FIXTURES.map((fixture) => ({
        ...createBlankReceipt(people, uxMode, fixture.label),
        id: createId(),
      }));
      set({ people, receipts, activeReceiptId: receipts[0].id, scanStateByReceipt: {} });
      MOCK_RECEIPT_FIXTURES.forEach((fixture, i) => {
        applyPayloadToReceipt(fixture.buildResponse(), receipts[i].id, people, uxMode);
      });
    },
    applyMockToCurrentReceipt: (index: number) => {
      const fixture = MOCK_RECEIPT_FIXTURES[index];
      if (!fixture) return;
      const { uxMode, people, activeReceiptId } = get();
      applyPayloadToReceipt(fixture.buildResponse(), activeReceiptId, people, uxMode);
    },
    getExportJson: () => {
      const { people, receipts, activeReceiptId } = get();
      return exportDraftToJson({ people, receipts, activeReceiptId });
    },
    importFromJson: (raw) => {
      const draft = importDraftFromJson(raw);
      if (!draft) {
        return;
      }
      const { uxMode } = get();
      set({
        people: draft.people,
        receipts: draft.receipts.map((r) => ({
          ...r,
          items: buildInitialItems(r.items, draft.people, uxMode),
        })),
        activeReceiptId: draft.activeReceiptId,
      });
    },

    // --- Receipt management actions ---

    addReceipt: () => {
      const { uxMode, people } = get();
      set((state) => {
        const nextNumber = state.receipts.length + 1;
        const newReceipt = createBlankReceipt(people, uxMode, `Receipt ${nextNumber}`);
        return {
          receipts: [...state.receipts, newReceipt],
          activeReceiptId: newReceipt.id,
        };
      });
    },
    removeReceipt: (receiptId) => {
      set((state) => {
        if (state.receipts.length <= 1) return state;
        const remaining = state.receipts.filter((r) => r.id !== receiptId);
        const nextActiveId =
          state.activeReceiptId === receiptId
            ? (remaining[remaining.length - 1]?.id ?? remaining[0].id)
            : state.activeReceiptId;
        return {
          receipts: remaining,
          activeReceiptId: nextActiveId,
        };
      });
    },
    setActiveReceiptId: (receiptId) => {
      set((state) => {
        if (!state.receipts.some((r) => r.id === receiptId)) return state;
        return { activeReceiptId: receiptId };
      });
    },
    renameReceipt: (receiptId, name) => {
      set((state) => ({
        receipts: state.receipts.map((r) =>
          r.id === receiptId ? { ...r, name: name.trim() || r.name } : r,
        ),
      }));
    },

    // --- Currency actions ---

    setReceiptCurrency: (receiptId, currency) => {
      set((state) => ({
        receipts: state.receipts.map((r) =>
          r.id === receiptId ? { ...r, currency, exchangeRateOverride: null } : r,
        ),
      }));
    },
    setReceiptExchangeRateOverride: (receiptId, rate) => {
      set((state) => ({
        receipts: state.receipts.map((r) =>
          r.id === receiptId ? { ...r, exchangeRateOverride: rate } : r,
        ),
      }));
    },
    fetchAndSetExchangeRates: async () => {
      const fetched = await fetchExchangeRates();
      if (fetched) {
        saveExchangeRates(fetched);
        set({ exchangeRates: fetched, exchangeRatesLastFetched: Date.now() });
      }
    },
  };
});
