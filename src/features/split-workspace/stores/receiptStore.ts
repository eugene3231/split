import { create } from 'zustand';
import {
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '@features/split-workspace/constants';
import {
  exportDraftToJson,
  loadPersistedDraft,
  savePersistedDraft,
} from '@features/split-workspace/logic/draftStorage';
import { BASE_CURRENCY } from '@shared/constants';
import { createId } from '@shared/logic/core/id';
import type { ChargeState, EditableItem, OcrResponse, Person, Receipt } from '@shared/types';
import type { SessionDraft, WorkspaceState } from '@features/split-workspace/types';
import {
  isNonEmpty,
  mapNonEmpty,
  type NonEmptyArray,
} from '@features/split-workspace/logic/nonEmpty';
import {
  buildInitialItems,
  createDefaultItem,
  syncItemsWithPeople,
} from '@features/split-workspace/logic/assignment';
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

function blankWorkspace(): WorkspaceState {
  const receipt = createBlankReceipt('Receipt 1');
  return { people: [], receipts: [receipt], activeReceiptId: receipt.id, payerMobile: '' };
}

function workspaceFromDraft(draft: SessionDraft): WorkspaceState {
  return {
    people: draft.people,
    receipts: mapNonEmpty(draft.receipts, (receipt) => ({
      ...receipt,
      items: buildInitialItems(receipt.items, draft.people),
    })),
    activeReceiptId: draft.activeReceiptId,
    payerMobile: draft.payerMobile,
  };
}

/** The workspace saved in this browser, or a blank one when nothing readable is saved. */
export function loadSavedWorkspace(): WorkspaceState {
  const draft = loadPersistedDraft();
  return draft ? workspaceFromDraft(draft) : blankWorkspace();
}

function patchReceiptById(
  receipts: NonEmptyArray<Receipt>,
  receiptId: string,
  patch: Partial<Receipt>,
): NonEmptyArray<Receipt> {
  return mapNonEmpty(receipts, (r) => (r.id === receiptId ? { ...r, ...patch } : r));
}

type ReceiptStoreState = WorkspaceState & {
  peopleInput: string;
};

type ReceiptStoreActions = {
  setPeopleInput: (next: string) => void;

  resetSplit: () => void;
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

/** The store always holds at least one receipt, and `activeReceiptId` names one of them. */
export function selectActiveReceipt(state: WorkspaceState): Receipt {
  return (
    state.receipts.find((receipt) => receipt.id === state.activeReceiptId) ?? state.receipts[0]
  );
}

export const useReceiptStore = create<ReceiptStore>((set, get) => {
  return {
    peopleInput: '',
    ...loadSavedWorkspace(),

    setPeopleInput: (next) => set({ peopleInput: next }),

    resetSplit: () => {
      set({ peopleInput: '', ...blankWorkspace() });
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
          receipts: mapNonEmpty(state.receipts, (r) => ({
            ...r,
            items: syncItemsWithPeople(r.items, people),
          })),
        };
      });
    },
    removeAllPeople: () => {
      set((state) => ({
        people: [],
        receipts: mapNonEmpty(state.receipts, (receipt) => ({
          ...receipt,
          items: syncItemsWithPeople(receipt.items, []),
        })),
      }));
    },
    removePerson: (personId) => {
      set((state) => {
        const people = state.people.filter((person) => person.id !== personId);
        return {
          ...state,
          people,
          receipts: mapNonEmpty(state.receipts, (r) => ({
            ...r,
            items: syncItemsWithPeople(r.items, people),
          })),
        };
      });
    },
    addItem: () => {
      set((state) => ({
        receipts: mapNonEmpty(state.receipts, (r) =>
          r.id === state.activeReceiptId ? { ...r, items: [...r.items, createDefaultItem()] } : r,
        ),
      }));
    },
    removeItem: (itemId) => {
      set((state) => {
        if (selectActiveReceipt(state).items.length <= 1) return state;
        return {
          receipts: mapNonEmpty(state.receipts, (r) =>
            r.id === state.activeReceiptId
              ? { ...r, items: r.items.filter((item) => item.id !== itemId) }
              : r,
          ),
        };
      });
    },
    updateItem: (itemId, updater) => {
      set((state) => ({
        receipts: mapNonEmpty(state.receipts, (r) =>
          r.id === state.activeReceiptId
            ? { ...r, items: r.items.map((item) => (item.id === itemId ? updater(item) : item)) }
            : r,
        ),
      }));
    },
    updateReceiptItem: (receiptId, itemId, updater) => {
      set((state) => ({
        receipts: mapNonEmpty(state.receipts, (r) =>
          r.id === receiptId
            ? { ...r, items: r.items.map((item) => (item.id === itemId ? updater(item) : item)) }
            : r,
        ),
      }));
    },
    splitUnassignedItemsEqually: () => {
      set((state) => ({
        receipts: mapNonEmpty(state.receipts, (r) => ({
          ...r,
          items: splitUnassignedItemsEqually(r.items, state.people),
        })),
      }));
    },
    setPersonOnReceiptItems: (receiptId, personId, checked) => {
      set((state) => ({
        receipts: mapNonEmpty(state.receipts, (r) =>
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
          receipts: patchReceiptById(state.receipts, receiptId, {
            items: assignEveryItemEqually(receipt.items, state.people),
          }),
        };
      });
    },
    setDiscount: (next) => {
      set((state) => ({
        receipts: patchReceiptById(state.receipts, state.activeReceiptId, { discount: next }),
      }));
    },
    setServiceCharge: (next) => {
      set((state) => ({
        receipts: patchReceiptById(state.receipts, state.activeReceiptId, {
          serviceCharge: next,
        }),
      }));
    },
    setGst: (next) => {
      set((state) => ({
        receipts: patchReceiptById(state.receipts, state.activeReceiptId, { gst: next }),
      }));
    },
    setReceiptTotalInput: (value) => {
      set((state) => ({
        receipts: patchReceiptById(state.receipts, state.activeReceiptId, {
          receiptTotalInput: value,
        }),
      }));
    },
    setRoundingInput: (value) => {
      set((state) => ({
        receipts: patchReceiptById(state.receipts, state.activeReceiptId, {
          roundingInput: value,
        }),
      }));
    },
    normalizeItems: () => {
      set((state) => ({
        receipts: patchReceiptById(state.receipts, state.activeReceiptId, {
          items: syncItemsWithPeople(selectActiveReceipt(state).items, state.people),
        }),
      }));
    },
    handleReceiptFileSelected: (file) => {
      set((state) => ({
        receipts: mapNonEmpty(state.receipts, (r) =>
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
          receipts: mapNonEmpty(state.receipts, (candidate) =>
            candidate.id === receipt.id ? { ...candidate, ...replacement } : candidate,
          ),
        };
      });
      return result;
    },
    patchReceipt: (receiptId, patch) => {
      set((state) => ({ receipts: patchReceiptById(state.receipts, receiptId, patch) }));
    },
    getExportJson: () => {
      const { people, receipts, activeReceiptId, payerMobile } = get();
      return exportDraftToJson({ people, receipts, activeReceiptId, payerMobile });
    },
    loadWorkspace: (draft) => {
      set({ peopleInput: '', ...workspaceFromDraft(draft) });
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
        const remaining = state.receipts.filter((r) => r.id !== receiptId);
        if (!isNonEmpty(remaining)) return state;
        return {
          receipts: remaining,
          activeReceiptId:
            state.activeReceiptId === receiptId
              ? remaining[remaining.length - 1].id
              : state.activeReceiptId,
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
        receipts: mapNonEmpty(state.receipts, (r) =>
          r.id === receiptId ? { ...r, name: name.trim() || r.name } : r,
        ),
      }));
    },

    setReceiptCurrency: (receiptId, currency) => {
      set((state) => ({
        receipts: mapNonEmpty(state.receipts, (r) =>
          r.id === receiptId ? { ...r, currency, exchangeRateOverride: null } : r,
        ),
      }));
    },
    setReceiptExchangeRateOverride: (receiptId, rate) => {
      set((state) => ({
        receipts: mapNonEmpty(state.receipts, (r) =>
          r.id === receiptId ? { ...r, exchangeRateOverride: rate } : r,
        ),
      }));
    },
  };
});

useReceiptStore.subscribe(({ people, receipts, activeReceiptId, payerMobile }) => {
  savePersistedDraft({
    version: 3,
    people,
    receipts,
    activeReceiptId,
    payerMobile,
    savedAt: new Date().toISOString(),
  });
});
