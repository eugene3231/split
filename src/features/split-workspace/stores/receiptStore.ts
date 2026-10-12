import { create } from 'zustand';
import {
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '@features/split-workspace/constants';
import {
  exportDraftToJson,
  loadPersistedDraft,
} from '@features/split-workspace/logic/draftStorage';
import { BASE_CURRENCY } from '@shared/constants';
import { createId } from '@shared/logic/core/id';
import type { ChargeState, EditableItem, OcrResponse, Person, Receipt } from '@shared/types';
import type { SessionDraft } from '@features/split-workspace/types';
import {
  buildInitialItems,
  createDefaultItem,
  normalizeItemAssignments,
  syncItemsWithPeople,
} from '@features/split-workspace/logic/simpleAssignments';
import {
  setPersonOnEveryItem,
  splitUnassignedItemsEqually,
} from '@features/split-workspace/logic/assignmentInteraction';
import { assignEveryItemEqually, canSplitEvenly } from '@features/split-workspace/logic/evenSplit';
import { buildReceiptOcrReplacement } from '@features/split-workspace/logic/applyOcrResultToReceipt';

type ReceiptScanCommit =
  { kind: 'applied' } | { kind: 'empty' } | { kind: 'changed' } | { kind: 'removed' };

interface ApplyReceiptScanArgs {
  receipt: Receipt;
  people: Person[];
  payload: OcrResponse;
}

function createBlankReceipt(name: string): Receipt {
  return {
    id: createId(),
    name,
    items: [createDefaultItem()],
    discount: { ...defaultDiscountState },
    serviceCharge: { ...defaultServiceChargeState },
    gst: { ...defaultGstState },
    receiptTotalInput: '',
    roundingInput: '',
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

type ReceiptStoreState = {
  peopleInput: string;

  initialized: boolean;
  people: Person[];
  receipts: Receipt[];
  activeReceiptId: string;
  payerMobile: string;
};

type ReceiptStoreActions = {
  setPeopleInput: (next: string) => void;

  initialize: () => void;
  resetSplit: () => void;
  reset: () => void;
  addPeopleFromInput: (rawInput: string) => void;
  addPeople: (names: string[]) => void;
  removePerson: (personId: string) => void;
  removeAllPeople: () => void;
  addItem: () => void;
  removeItem: (itemId: string) => void;
  updateItem: (itemId: string, updater: (item: EditableItem) => EditableItem) => void;
  updateReceiptItem: (
    receiptId: string,
    itemId: string,
    updater: (item: EditableItem) => EditableItem,
  ) => void;
  splitUnassignedItemsEqually: () => void;
  splitReceiptEvenly: (receiptId: string) => void;
  setPersonOnReceiptItems: (receiptId: string, personId: string, checked: boolean) => void;
  setDiscount: (next: ChargeState) => void;
  setServiceCharge: (next: ChargeState) => void;
  setGst: (next: ChargeState) => void;
  setReceiptTotalInput: (value: string) => void;
  setRoundingInput: (value: string) => void;
  normalizeItems: () => void;
  handleReceiptFileSelected: (file: File | null) => void;
  applyReceiptScan: (args: ApplyReceiptScanArgs) => ReceiptScanCommit;
  patchReceipt: (receiptId: string, patch: Partial<Receipt>) => void;
  getExportJson: () => string;
  loadWorkspace: (draft: SessionDraft) => void;

  setPayerMobile: (mobile: string) => void;

  addReceipt: () => void;
  removeReceipt: (receiptId: string) => void;
  setActiveReceiptId: (receiptId: string) => void;
  renameReceipt: (receiptId: string, name: string) => void;

  setReceiptCurrency: (receiptId: string, currency: string) => void;
  setReceiptExchangeRateOverride: (receiptId: string, rate: number | null) => void;
};

type ReceiptStore = ReceiptStoreState & ReceiptStoreActions;

const initialState: ReceiptStoreState = {
  peopleInput: '',

  initialized: false,
  people: [],
  receipts: [],
  activeReceiptId: '',
  payerMobile: '',
};

export const useReceiptStore = create<ReceiptStore>((set, get) => {
  return {
    ...initialState,

    setPeopleInput: (next) => set({ peopleInput: next }),

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
        const blankReceipt = createBlankReceipt('Receipt 1');
        set({
          initialized: true,
          people: [],
          receipts: [blankReceipt],
          activeReceiptId: blankReceipt.id,
        });
      }
    },
    resetSplit: () => {
      const receipt = createBlankReceipt('Receipt 1');
      set({
        initialized: true,
        peopleInput: '',
        people: [],
        receipts: [receipt],
        activeReceiptId: receipt.id,
        payerMobile: '',
      });
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

      get().addPeople(nextNames);
      set({ peopleInput: '' });
    },
    addPeople: (names) => {
      set((state) => {
        const existing = new Set(state.people.map((person) => person.name.toLowerCase()));
        const additions = names
          .map((name) => name.trim())
          .filter((name) => {
            const key = name.toLowerCase();
            if (key.length === 0 || existing.has(key)) return false;
            existing.add(key);
            return true;
          })
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
    },
    removeAllPeople: () => {
      set((state) => ({
        people: [],
        receipts: state.receipts.map((receipt) => ({
          ...receipt,
          items: receipt.items.map((item) => ({
            ...item,
            assignment: { mode: 'equal', personId: '', personIds: [] },
          })),
        })),
      }));
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
          r.id === state.activeReceiptId ? { ...r, items: [...r.items, createDefaultItem()] } : r,
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
    updateReceiptItem: (receiptId, itemId, updater) => {
      set((state) => ({
        receipts: state.receipts.map((r) =>
          r.id === receiptId
            ? { ...r, items: r.items.map((item) => (item.id === itemId ? updater(item) : item)) }
            : r,
        ),
      }));
    },
    splitUnassignedItemsEqually: () => {
      set((state) => ({
        receipts: state.receipts.map((r) => ({
          ...r,
          items: splitUnassignedItemsEqually(r.items, state.people),
        })),
      }));
    },
    setPersonOnReceiptItems: (receiptId, personId, checked) => {
      set((state) => ({
        receipts: state.receipts.map((r) =>
          r.id === receiptId
            ? { ...r, items: setPersonOnEveryItem(r.items, personId, checked) }
            : r,
        ),
      }));
    },
    splitReceiptEvenly: (receiptId) => {
      set((state) => {
        const receipt = state.receipts.find((entry) => entry.id === receiptId);
        if (!receipt || !canSplitEvenly(receipt.items, state.people)) return state;
        return {
          receipts: updateActiveReceipt(state.receipts, receiptId, {
            items: assignEveryItemEqually(receipt.items, state.people),
          }),
        };
      });
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
    setRoundingInput: (value) => {
      set((state) => ({
        receipts: updateActiveReceipt(state.receipts, state.activeReceiptId, {
          roundingInput: value,
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
              }
            : r,
        ),
      }));
    },
    applyReceiptScan: ({ receipt, people, payload }) => {
      let result: ReceiptScanCommit = { kind: 'changed' };
      set((state) => {
        const currentReceipt = state.receipts.find((candidate) => candidate.id === receipt.id);
        if (!currentReceipt) {
          result = { kind: 'removed' };
          return state;
        }
        if (currentReceipt !== receipt || state.people !== people) {
          return state;
        }
        if (payload.items.length === 0) {
          result = { kind: 'empty' };
          return state;
        }

        result = { kind: 'applied' };
        const replacement = buildReceiptOcrReplacement(payload);
        return {
          receipts: state.receipts.map((candidate) =>
            candidate.id === receipt.id ? { ...candidate, ...replacement } : candidate,
          ),
        };
      });
      return result;
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
    loadWorkspace: (draft) => {
      set({
        initialized: true,
        peopleInput: '',
        people: draft.people,
        receipts: draft.receipts.map((r) => ({
          ...r,
          items: buildInitialItems(r.items, draft.people),
        })),
        activeReceiptId: draft.activeReceiptId,
        payerMobile: draft.payerMobile,
      });
    },

    setPayerMobile: (mobile) => set({ payerMobile: mobile }),

    addReceipt: () => {
      set((state) => {
        const nextNumber = state.receipts.length + 1;
        const newReceipt = createBlankReceipt(`Receipt ${nextNumber}`);
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
