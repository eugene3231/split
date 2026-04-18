import { create } from 'zustand';
import {
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '@features/split-workspace/constants';
import {
  exportDraftToJson,
  importDraftFromJson,
  loadPersistedDraft,
} from '@features/split-workspace/logic/draftStorage';
import { BASE_CURRENCY } from '@shared/constants';
import { createId } from '@shared/logic/core/id';
import type { ChargeState, EditableItem, Person, Receipt } from '@shared/types';
import {
  buildInitialItems,
  createDefaultItem,
  normalizeItemAssignments,
  syncItemsWithPeople,
} from '@features/split-workspace/logic/simpleAssignments';

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

function createBlankReceipt(people: Person[], name: string): Receipt {
  return {
    id: createId(),
    name,
    items: [createDefaultItem(people)],
    discount: { ...defaultDiscountState },
    serviceCharge: { ...defaultServiceChargeState },
    gst: { ...defaultGstState },
    receiptTotalInput: '',
    currency: BASE_CURRENCY,
    exchangeRateOverride: null,
  };
}

function updateActiveReceipt(
  receipts: Receipt[],
  activeReceiptId: string,
  patch: Partial<Receipt>,
): Receipt[] {
  return receipts.map((r) => (r.id === activeReceiptId ? { ...r, ...patch } : r));
}

// ---------------------------------------------------------------------------
// Combined store type
// ---------------------------------------------------------------------------

type ReceiptStoreState = {
  // UI form state
  peopleInput: string;

  // Workspace state
  initialized: boolean;
  people: Person[];
  receipts: Receipt[];
  activeReceiptId: string;
  payerMobile: string;
};

type ReceiptStoreActions = {
  // UI form actions
  setPeopleInput: (next: string) => void;

  // Workspace actions
  initialize: () => void;
  reset: () => void;
  addPeopleFromInput: (rawInput: string) => void;
  removePerson: (personId: string) => void;
  addItem: () => void;
  removeItem: (itemId: string) => void;
  updateItem: (itemId: string, updater: (item: EditableItem) => EditableItem) => void;
  setDiscount: (next: ChargeState) => void;
  setServiceCharge: (next: ChargeState) => void;
  setGst: (next: ChargeState) => void;
  setReceiptTotalInput: (value: string) => void;
  normalizeItems: () => void;
  handleReceiptFileSelected: (file: File | null) => void;
  patchReceipt: (receiptId: string, patch: Partial<Receipt>) => void;
  getExportJson: () => string;
  importFromJson: (raw: string) => void;

  // Payer actions
  setPayerMobile: (mobile: string) => void;

  // Receipt management actions
  addReceipt: () => void;
  removeReceipt: (receiptId: string) => void;
  setActiveReceiptId: (receiptId: string) => void;
  renameReceipt: (receiptId: string, name: string) => void;

  // Currency actions (modify receipts, so stay here)
  setReceiptCurrency: (receiptId: string, currency: string) => void;
  setReceiptExchangeRateOverride: (receiptId: string, rate: number | null) => void;
};

type ReceiptStore = ReceiptStoreState & ReceiptStoreActions;

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: ReceiptStoreState = {
  peopleInput: '',

  initialized: false,
  people: [],
  receipts: [],
  activeReceiptId: '',
  payerMobile: '',
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useReceiptStore = create<ReceiptStore>((set, get) => {
  return {
    ...initialState,

    // --- UI form actions ---

    setPeopleInput: (next) => set({ peopleInput: next }),

    // --- Workspace actions ---

    initialize: () => {
      if (get().initialized) {
        return;
      }

      const draft = loadPersistedDraft();
      if (draft) {
        const receipts = draft.receipts.map((r) => ({
          ...r,
          items: buildInitialItems(r.items, draft.people),
        }));
        set({
          initialized: true,
          people: draft.people,
          receipts,
          activeReceiptId: draft.activeReceiptId,
          payerMobile: draft.payerMobile,
        });
      } else {
        const blankReceipt = createBlankReceipt([], 'Receipt 1');
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
        payerMobile: '',
      });
    },
    addPeopleFromInput: (rawInput) => {
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
            items: syncItemsWithPeople(r.items, people),
          })),
        };
      });

      set({ peopleInput: '' });
    },
    removePerson: (personId) => {
      set((state) => {
        const people = state.people.filter((person) => person.id !== personId);
        return {
          ...state,
          people,
          receipts: state.receipts.map((r) => ({
            ...r,
            items: syncItemsWithPeople(r.items, people),
          })),
        };
      });
    },
    addItem: () => {
      set((state) => ({
        receipts: state.receipts.map((r) =>
          r.id === state.activeReceiptId
            ? { ...r, items: [...r.items, createDefaultItem(state.people)] }
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
        receipts: updateActiveReceipt(state.receipts, state.activeReceiptId, { discount: next }),
      }));
    },
    setServiceCharge: (next) => {
      set((state) => ({
        receipts: updateActiveReceipt(state.receipts, state.activeReceiptId, {
          serviceCharge: next,
        }),
      }));
    },
    setGst: (next) => {
      set((state) => ({
        receipts: updateActiveReceipt(state.receipts, state.activeReceiptId, { gst: next }),
      }));
    },
    setReceiptTotalInput: (value) => {
      set((state) => ({
        receipts: updateActiveReceipt(state.receipts, state.activeReceiptId, {
          receiptTotalInput: value,
        }),
      }));
    },
    normalizeItems: () => {
      set((state) => {
        const active = state.receipts.find((r) => r.id === state.activeReceiptId);
        if (!active) return state;
        return {
          receipts: updateActiveReceipt(state.receipts, state.activeReceiptId, {
            items: normalizeItemAssignments(active.items, state.people),
          }),
        };
      });
    },
    handleReceiptFileSelected: (file) => {
      set((state) => ({
        receipts: state.receipts.map((r) =>
          r.id === state.activeReceiptId
            ? {
                ...r,
                receiptFile: file,
                ...(file
                  ? {
                      items: [createDefaultItem(state.people)],
                      discount: { ...defaultDiscountState },
                      serviceCharge: { ...defaultServiceChargeState },
                      gst: { ...defaultGstState },
                      receiptTotalInput: '',
                    }
                  : {}),
              }
            : r,
        ),
      }));
    },
    patchReceipt: (receiptId, patch) => {
      set((state) => ({
        receipts: state.receipts.map((r) => (r.id === receiptId ? { ...r, ...patch } : r)),
      }));
    },
    getExportJson: () => {
      const { people, receipts, activeReceiptId, payerMobile } = get();
      return exportDraftToJson({ people, receipts, activeReceiptId, payerMobile });
    },
    importFromJson: (raw) => {
      const draft = importDraftFromJson(raw);
      if (!draft) {
        return;
      }
      set({
        people: draft.people,
        receipts: draft.receipts.map((r) => ({
          ...r,
          items: buildInitialItems(r.items, draft.people),
        })),
        activeReceiptId: draft.activeReceiptId,
        payerMobile: draft.payerMobile,
      });
    },

    // --- Payer actions ---

    setPayerMobile: (mobile) => set({ payerMobile: mobile }),

    // --- Receipt management actions ---

    addReceipt: () => {
      const { people } = get();
      set((state) => {
        const nextNumber = state.receipts.length + 1;
        const newReceipt = createBlankReceipt(people, `Receipt ${nextNumber}`);
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
  };
});
