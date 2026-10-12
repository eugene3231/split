import { create } from 'zustand';
import {
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '@features/split-workspace/constants';
import {
  loadPersistedDraft,
  savePersistedDraft,
} from '@features/split-workspace/logic/draftStorage';
import { BASE_CURRENCY, type CurrencyCode } from '@shared/constants';
import { createId } from '@shared/logic/core/id';
import type { EditableItem, OcrResponse, Person, Receipt } from '@shared/types';
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

function updateReceipt(
  receipts: NonEmptyArray<Receipt>,
  receiptId: string,
  update: (receipt: Receipt) => Receipt,
): NonEmptyArray<Receipt> {
  return mapNonEmpty(receipts, (receipt) => (receipt.id === receiptId ? update(receipt) : receipt));
}

function syncReceiptsWithPeople(
  receipts: NonEmptyArray<Receipt>,
  people: Person[],
): NonEmptyArray<Receipt> {
  return mapNonEmpty(receipts, (receipt) => ({
    ...receipt,
    items: syncItemsWithPeople(receipt.items, people),
  }));
}

/** Any field of a receipt except the id it is addressed by. */
export type ReceiptPatch = Partial<Omit<Receipt, 'id'>>;

interface ReceiptStoreActions {
  /** Adds the names that are not blank and not already in the split. */
  addPeople: (names: string[]) => void;
  removePerson: (personId: string) => void;
  removeAllPeople: () => void;

  addReceipt: () => void;
  /** The last receipt stays: a workspace always has one. */
  removeReceipt: (receiptId: string) => void;
  setActiveReceiptId: (receiptId: string) => void;
  /** A blank name keeps the current one. */
  renameReceipt: (receiptId: string, name: string) => void;
  /** A custom exchange rate belongs to the currency it was typed for, so it is cleared. */
  setReceiptCurrency: (receiptId: string, currency: CurrencyCode) => void;
  patchReceipt: (receiptId: string, patch: ReceiptPatch) => void;
  applyReceiptScan: (args: ApplyReceiptScanArgs) => ReceiptScanCommit;

  addItem: (receiptId: string) => void;
  /** The last item stays: a receipt always has a row to type into. */
  removeItem: (receiptId: string, itemId: string) => void;
  updateItem: (
    receiptId: string,
    itemId: string,
    update: (item: EditableItem) => EditableItem,
  ) => void;
  /** Rewrites every item on a receipt at once, such as splitting them all evenly. */
  updateItems: (
    receiptId: string,
    update: (items: EditableItem[], people: Person[]) => EditableItem[],
  ) => void;

  setPayerMobile: (mobile: string) => void;
  resetSplit: () => void;
  loadWorkspace: (draft: SessionDraft) => void;
}

type ReceiptStore = WorkspaceState & ReceiptStoreActions;

/** The store always holds at least one receipt, and `activeReceiptId` names one of them. */
export function selectActiveReceipt(state: WorkspaceState): Receipt {
  return (
    state.receipts.find((receipt) => receipt.id === state.activeReceiptId) ?? state.receipts[0]
  );
}

export const useReceiptStore = create<ReceiptStore>((set) => ({
  ...loadSavedWorkspace(),

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
      return { people, receipts: syncReceiptsWithPeople(state.receipts, people) };
    });
  },
  removePerson: (personId) => {
    set((state) => {
      const people = state.people.filter((person) => person.id !== personId);
      return { people, receipts: syncReceiptsWithPeople(state.receipts, people) };
    });
  },
  removeAllPeople: () => {
    set((state) => ({ people: [], receipts: syncReceiptsWithPeople(state.receipts, []) }));
  },

  addReceipt: () => {
    set((state) => {
      const receipt = createBlankReceipt(`Receipt ${state.receipts.length + 1}`);
      return { receipts: [...state.receipts, receipt], activeReceiptId: receipt.id };
    });
  },
  removeReceipt: (receiptId) => {
    set((state) => {
      const remaining = state.receipts.filter((receipt) => receipt.id !== receiptId);
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
      if (!state.receipts.some((receipt) => receipt.id === receiptId)) return state;
      return { activeReceiptId: receiptId };
    });
  },
  renameReceipt: (receiptId, name) => {
    set((state) => ({
      receipts: updateReceipt(state.receipts, receiptId, (receipt) => ({
        ...receipt,
        name: name.trim() || receipt.name,
      })),
    }));
  },
  setReceiptCurrency: (receiptId, currency) => {
    set((state) => ({
      receipts: updateReceipt(state.receipts, receiptId, (receipt) => ({
        ...receipt,
        currency,
        exchangeRateOverride: null,
      })),
    }));
  },
  patchReceipt: (receiptId, patch) => {
    set((state) => ({
      receipts: updateReceipt(state.receipts, receiptId, (receipt) => ({ ...receipt, ...patch })),
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
        receipts: updateReceipt(state.receipts, receipt.id, (candidate) => ({
          ...candidate,
          ...replacement,
        })),
      };
    });
    return result;
  },

  addItem: (receiptId) => {
    set((state) => ({
      receipts: updateReceipt(state.receipts, receiptId, (receipt) => ({
        ...receipt,
        items: [...receipt.items, createDefaultItem()],
      })),
    }));
  },
  removeItem: (receiptId, itemId) => {
    set((state) => ({
      receipts: updateReceipt(state.receipts, receiptId, (receipt) =>
        receipt.items.length <= 1
          ? receipt
          : { ...receipt, items: receipt.items.filter((item) => item.id !== itemId) },
      ),
    }));
  },
  updateItem: (receiptId, itemId, update) => {
    set((state) => ({
      receipts: updateReceipt(state.receipts, receiptId, (receipt) => ({
        ...receipt,
        items: receipt.items.map((item) => (item.id === itemId ? update(item) : item)),
      })),
    }));
  },
  updateItems: (receiptId, update) => {
    set((state) => ({
      receipts: updateReceipt(state.receipts, receiptId, (receipt) => ({
        ...receipt,
        items: update(receipt.items, state.people),
      })),
    }));
  },

  setPayerMobile: (mobile) => set({ payerMobile: mobile }),
  resetSplit: () => set(blankWorkspace()),
  loadWorkspace: (draft) => set(workspaceFromDraft(draft)),
}));

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
