import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GEMINI_MODEL } from '@features/receipt-scanner/constants';
import {
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
  LOCAL_STORAGE_DRAFT_KEY,
  LOCAL_STORAGE_OCR_SETTINGS_KEY,
  SESSION_STORAGE_GEMINI_API_KEY,
} from '@features/split-workspace/constants';
import {
  loadSavedWorkspace,
  selectActiveReceipt,
  createWorkspaceStore,
  retireWorkspace,
  reviveWorkspace,
  quickSplitStore,
} from '@features/split-workspace/stores/receiptStore';
import { loadPersistedDraft } from '@features/split-workspace/logic/draftStorage';
import { useScanStore } from '@features/receipt-scanner/stores/scanStore';
import { useGeminiStore } from '@features/split-workspace/stores/geminiStore';
import type { OcrResponse, Person, Receipt } from '@shared/types';
import { makeItem, makeReceipt } from '../../../tests/integration/testHelpers';
import { PRESET_WORKSPACES } from '@features/split-workspace/logic/presetWorkspaces';
import { NOBODY, equalShares, makeAssignment } from '@features/split-workspace/logic/assignment';
import {
  setPersonOnEveryItem,
  splitUnassignedItemsEqually,
} from '@features/split-workspace/logic/assignmentInteraction';
import { assignEveryItemEqually } from '@features/split-workspace/logic/evenSplit';

const FIRST_LOADING_MESSAGE = 'Asking Gemini to decipher cryptic cashier handwriting...';
const SECOND_LOADING_MESSAGE = 'Negotiating with suspiciously smudged totals...';

const TEST_RECEIPT_ID = 'test-receipt-1';

function makeScanPayload(): OcrResponse {
  return {
    items: [{ description: 'Scanned meal', amount: 12 }],
    subtotal: 12,
    total: 12,
    detected: {
      serviceCharge: {
        enabled: false,
        amount: null,
        percent: null,
        confidence: null,
        source: 'none',
      },
      gst: { enabled: false, amount: null, percent: null, confidence: null, source: 'none' },
    },
    warnings: [],
  };
}

function resetStore() {
  quickSplitStore.getState().resetSplit();
  useScanStore.setState({ scanStateByReceipt: {} });
  useGeminiStore.setState({
    geminiApiKeyInput: '',
    geminiModel: DEFAULT_GEMINI_MODEL,
    showApiKeyModal: false,
  });
}

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('scanStore + geminiStore', () => {
  it('startScan sets loading baseline and randomized loading message', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    useScanStore.getState().startScan(TEST_RECEIPT_ID);
    const scanState = useScanStore.getState().scanStateByReceipt[TEST_RECEIPT_ID];

    expect(scanState.isScanning).toBe(true);
    expect(scanState.scanError).toBeNull();
    expect(scanState.scanWarnings).toEqual([]);
    expect(scanState.loadingMessage).toBe(FIRST_LOADING_MESSAGE);
    expect(scanState.loadingMessageIndex).toBe(0);
  });

  it('advanceLoadingMessage picks a different random message', () => {
    const randomSpy = vi.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0);
    randomSpy.mockReturnValueOnce(0);

    useScanStore.getState().startScan(TEST_RECEIPT_ID);
    const firstScanState = useScanStore.getState().scanStateByReceipt[TEST_RECEIPT_ID];

    useScanStore.getState().advanceLoadingMessage();
    const scanState = useScanStore.getState().scanStateByReceipt[TEST_RECEIPT_ID];

    expect(scanState.loadingMessageIndex).toBe(1);
    expect(scanState.loadingMessage).toBe(SECOND_LOADING_MESSAGE);
    expect(scanState.loadingMessage).not.toBe(firstScanState.loadingMessage);
  });

  it('advanceLoadingMessage skips receipts that are not scanning', () => {
    useScanStore.setState({
      scanStateByReceipt: {
        [TEST_RECEIPT_ID]: {
          isScanning: false,
          scanError: null,
          scanWarnings: [],
          loadingMessage: 'old message',
          loadingMessageIndex: 2,
        },
      },
    });

    useScanStore.getState().advanceLoadingMessage();

    const scanState = useScanStore.getState().scanStateByReceipt[TEST_RECEIPT_ID];
    expect(scanState.loadingMessageIndex).toBe(2);
    expect(scanState.loadingMessage).toBe('old message');
  });

  it('finishScan clears active loading state', () => {
    useScanStore.getState().startScan(TEST_RECEIPT_ID);
    useScanStore.getState().setScanError(TEST_RECEIPT_ID, 'network issue');
    useScanStore.getState().setScanWarnings(TEST_RECEIPT_ID, ['retry']);

    useScanStore.getState().finishScan(TEST_RECEIPT_ID);
    const scanState = useScanStore.getState().scanStateByReceipt[TEST_RECEIPT_ID];
    expect(scanState.isScanning).toBe(false);
    expect(scanState.loadingMessage).toBe('');
    expect(scanState.loadingMessageIndex).toBe(0);
    expect(scanState.scanError).toBe('network issue');
    expect(scanState.scanWarnings).toEqual(['retry']);
  });

  it('clearScanFeedback clears scan feedback only', () => {
    useScanStore.setState({
      scanStateByReceipt: {
        [TEST_RECEIPT_ID]: {
          isScanning: true,
          scanError: 'boom',
          scanWarnings: ['low confidence'],
          loadingMessage: 'Working...',
          loadingMessageIndex: 3,
        },
      },
    });

    useScanStore.getState().clearScanFeedback(TEST_RECEIPT_ID);
    const scanState = useScanStore.getState().scanStateByReceipt[TEST_RECEIPT_ID];

    expect(scanState.scanError).toBeNull();
    expect(scanState.scanWarnings).toEqual([]);
    expect(scanState.loadingMessage).toBe('');
    expect(scanState.loadingMessageIndex).toBe(0);

    expect(scanState.isScanning).toBe(true);
  });

  it('persists gemini model changes through the store action', () => {
    useGeminiStore.getState().setGeminiModel('gemini-3.7-flash');

    expect(useGeminiStore.getState().geminiModel).toBe('gemini-3.7-flash');
    expect(window.localStorage.getItem(LOCAL_STORAGE_OCR_SETTINGS_KEY)).toContain(
      '"geminiModel":"gemini-3.7-flash"',
    );
  });

  it('keeps the gemini api key for the session and forgets it when cleared', () => {
    useGeminiStore.getState().setGeminiApiKeyInput('session-key');
    expect(window.sessionStorage.getItem(SESSION_STORAGE_GEMINI_API_KEY)).toBe('session-key');

    useGeminiStore.getState().setGeminiApiKeyInput('');
    expect(window.sessionStorage.getItem(SESSION_STORAGE_GEMINI_API_KEY)).toBeNull();
  });
});

describe('saving and loading the workspace', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('opens with the saved workspace when the app loads', async () => {
    quickSplitStore.getState().addPeople(['Alice']);
    quickSplitStore.getState().setPayerMobile('91234567');
    const receiptId = quickSplitStore.getState().activeReceiptId;

    vi.resetModules();
    const reloaded = await import('@features/split-workspace/stores/receiptStore');

    const state = reloaded.quickSplitStore.getState();
    expect(reloaded.quickSplitStore).not.toBe(quickSplitStore);
    expect(state.people.map((person) => person.name)).toEqual(['Alice']);
    expect(state.payerMobile).toBe('91234567');
    expect(state.receipts.map((receipt) => receipt.id)).toEqual([receiptId]);
    expect(state.activeReceiptId).toBe(receiptId);
  });

  it('saves nothing once its editor has closed, so a late change cannot overwrite a reopened draft', () => {
    const workspace = createWorkspaceStore({ draftKey: 'test:draft', wizardKey: 'test:wizard' });
    workspace.getState().addPeople(['Alice']);

    retireWorkspace(workspace);
    workspace.getState().addPeople(['Bob']);
    const whileClosed = loadPersistedDraft('test:draft')?.people.map((person) => person.name);
    reviveWorkspace(workspace);
    workspace.getState().addPeople(['Cat']);

    expect(whileClosed).toEqual(['Alice']);
    expect(loadPersistedDraft('test:draft')?.people.map((person) => person.name)).toEqual([
      'Alice',
      'Bob',
      'Cat',
    ]);
  });

  it('opens with one blank receipt when nothing is saved', () => {
    const workspace = createWorkspaceStore({
      draftKey: 'test:draft',
      wizardKey: 'test:wizard',
    }).getState();

    expect(workspace.people).toEqual([]);
    expect(workspace.payerMobile).toBe('');
    expect(workspace.receipts).toHaveLength(1);
    expect(workspace.receipts[0].name).toBe('Receipt 1');
    expect(workspace.receipts[0].items).toHaveLength(1);
    expect(workspace.activeReceiptId).toBe(workspace.receipts[0].id);
  });

  it('opens with one blank receipt when what is saved cannot be read', () => {
    window.localStorage.setItem(LOCAL_STORAGE_DRAFT_KEY, '{broken');

    expect(loadSavedWorkspace(LOCAL_STORAGE_DRAFT_KEY)).toBeNull();
    const workspace = createWorkspaceStore({
      draftKey: LOCAL_STORAGE_DRAFT_KEY,
      wizardKey: 'test:wizard',
    }).getState();
    expect(workspace.receipts).toHaveLength(1);
    expect(workspace.people).toEqual([]);
  });

  it('saves every change as it is made', () => {
    quickSplitStore.getState().addPeople(['Alice', 'Bob']);
    expect(
      loadPersistedDraft(LOCAL_STORAGE_DRAFT_KEY)?.people.map((person) => person.name),
    ).toEqual(['Alice', 'Bob']);

    const receiptId = quickSplitStore.getState().activeReceiptId;
    quickSplitStore.getState().patchReceipt(receiptId, { receiptTotalInput: '42.00' });
    expect(loadPersistedDraft(LOCAL_STORAGE_DRAFT_KEY)?.receipts[0].receiptTotalInput).toBe(
      '42.00',
    );

    quickSplitStore.getState().resetSplit();
    expect(loadPersistedDraft(LOCAL_STORAGE_DRAFT_KEY)?.people).toEqual([]);
    expect(loadPersistedDraft(LOCAL_STORAGE_DRAFT_KEY)?.receipts[0].id).toBe(
      quickSplitStore.getState().activeReceiptId,
    );
  });

  it('falls back to the first receipt when the active id names none', () => {
    const [first] = quickSplitStore.getState().receipts;
    quickSplitStore.setState({ activeReceiptId: 'gone' });

    expect(selectActiveReceipt(quickSplitStore.getState())).toBe(first);
  });
});

describe('receipt management', () => {
  it('replaces the workspace with a blank one under a new receipt ID', () => {
    quickSplitStore.getState().addPeople(['Alice']);
    quickSplitStore.getState().setPayerMobile('91234567');
    const oldReceiptId = quickSplitStore.getState().activeReceiptId;

    quickSplitStore.getState().resetSplit();

    const state = quickSplitStore.getState();
    expect(state.people).toEqual([]);
    expect(state.payerMobile).toBe('');
    expect(state.receipts).toHaveLength(1);
    expect(state.receipts[0].id).not.toBe(oldReceiptId);
    expect(state.activeReceiptId).toBe(state.receipts[0].id);
    expect(state.receipts[0].items[0].amountInput).toBe('');
  });

  it('addReceipt creates a new receipt and activates it', () => {
    expect(quickSplitStore.getState().receipts).toHaveLength(1);

    quickSplitStore.getState().addReceipt();
    const state = quickSplitStore.getState();

    expect(state.receipts).toHaveLength(2);
    expect(state.activeReceiptId).toBe(state.receipts[1].id);
    expect(state.receipts[1].name).toBe('Receipt 2');
  });

  it('removeReceipt removes a receipt and updates activeReceiptId', () => {
    quickSplitStore.getState().addReceipt();

    const stateBefore = quickSplitStore.getState();
    const firstId = stateBefore.receipts[0].id;
    const secondId = stateBefore.receipts[1].id;
    expect(stateBefore.activeReceiptId).toBe(secondId);

    quickSplitStore.getState().removeReceipt(secondId);
    const state = quickSplitStore.getState();

    expect(state.receipts).toHaveLength(1);
    expect(state.activeReceiptId).toBe(firstId);
  });

  it('removeReceipt does not remove the last remaining receipt', () => {
    const receiptId = quickSplitStore.getState().receipts[0].id;

    quickSplitStore.getState().removeReceipt(receiptId);

    expect(quickSplitStore.getState().receipts).toHaveLength(1);
  });

  it('setActiveReceiptId switches the active receipt', () => {
    quickSplitStore.getState().addReceipt();

    const firstId = quickSplitStore.getState().receipts[0].id;
    quickSplitStore.getState().setActiveReceiptId(firstId);

    expect(quickSplitStore.getState().activeReceiptId).toBe(firstId);
  });

  it('setActiveReceiptId ignores unknown receipt ids', () => {
    const currentId = quickSplitStore.getState().activeReceiptId;

    quickSplitStore.getState().setActiveReceiptId('nonexistent-id');

    expect(quickSplitStore.getState().activeReceiptId).toBe(currentId);
  });

  it('renameReceipt updates the receipt name', () => {
    const receiptId = quickSplitStore.getState().receipts[0].id;

    quickSplitStore.getState().renameReceipt(receiptId, 'Dinner at Mario');
    const receipt = quickSplitStore.getState().receipts.find((r) => r.id === receiptId);

    expect(receipt?.name).toBe('Dinner at Mario');
  });

  it('renameReceipt ignores blank names', () => {
    const receiptId = quickSplitStore.getState().receipts[0].id;
    const originalName = quickSplitStore.getState().receipts[0].name;

    quickSplitStore.getState().renameReceipt(receiptId, '   ');
    const receipt = quickSplitStore.getState().receipts.find((r) => r.id === receiptId);

    expect(receipt?.name).toBe(originalName);
  });
});

describe('receipt scan commits', () => {
  it('commits extraction once and rejects another result captured from the same receipt', () => {
    const captured = quickSplitStore.getState();
    const args = {
      receipt: captured.receipts[0],
      people: captured.people,
      payload: makeScanPayload(),
    };

    expect(quickSplitStore.getState().applyReceiptScan(args)).toEqual({ kind: 'applied' });
    const applied = quickSplitStore.getState().receipts[0];
    expect(applied.items[0].name).toBe('Scanned meal');
    expect(quickSplitStore.getState().applyReceiptScan(args)).toEqual({ kind: 'changed' });
    expect(quickSplitStore.getState().receipts[0]).toBe(applied);
  });

  it('leaves every receipt field unchanged for empty extraction', () => {
    const captured = quickSplitStore.getState();

    const result = captured.applyReceiptScan({
      receipt: captured.receipts[0],
      people: captured.people,
      payload: { ...makeScanPayload(), items: [] },
    });

    expect(result).toEqual({ kind: 'empty' });
    expect(quickSplitStore.getState().receipts[0]).toBe(captured.receipts[0]);
  });

  it('rejects a changed people snapshot even if the receipt is unchanged', () => {
    const captured = quickSplitStore.getState();
    quickSplitStore.setState({ people: [...captured.people] });

    const result = captured.applyReceiptScan({
      receipt: captured.receipts[0],
      people: captured.people,
      payload: makeScanPayload(),
    });

    expect(result).toEqual({ kind: 'changed' });
    expect(quickSplitStore.getState().receipts[0]).toBe(captured.receipts[0]);
  });

  it('rejects a scan for a receipt removed from the workspace', () => {
    const captured = quickSplitStore.getState();
    quickSplitStore.getState().addReceipt();
    quickSplitStore.getState().removeReceipt(captured.receipts[0].id);

    const result = captured.applyReceiptScan({
      receipt: captured.receipts[0],
      people: captured.people,
      payload: makeScanPayload(),
    });

    expect(result).toEqual({ kind: 'removed' });
    expect(quickSplitStore.getState().receipts).toHaveLength(1);
    expect(quickSplitStore.getState().receipts[0].items[0].amountInput).toBe('');
  });
});

describe('receiptStore additional coverage', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('addPeople ignores blank names', () => {
    quickSplitStore.getState().addPeople(['   ', '']);
    expect(quickSplitStore.getState().people).toHaveLength(0);
  });

  it('keeps only the first spelling of each name within a batch', () => {
    quickSplitStore.getState().addPeople(['Alice']);

    quickSplitStore.getState().addPeople([' Sam', ' sam', 'BOB', ' Bob', ' alice ']);

    expect(quickSplitStore.getState().people.map((person) => person.name)).toEqual([
      'Alice',
      'Sam',
      'BOB',
    ]);
  });

  it('removeItem is a no-op when only one item remains', () => {
    const receiptId = quickSplitStore.getState().activeReceiptId;
    const itemId = quickSplitStore.getState().receipts.find((r) => r.id === receiptId)!.items[0].id;

    quickSplitStore.getState().removeItem(receiptId, itemId);
    const items = quickSplitStore.getState().receipts.find((r) => r.id === receiptId)!.items;
    expect(items).toHaveLength(1);
  });

  it('keeps receipt draft fields when selecting a file', () => {
    const receiptId = quickSplitStore.getState().activeReceiptId;
    quickSplitStore.getState().patchReceipt(receiptId, { receiptTotalInput: '15.00' });
    const before = quickSplitStore.getState().receipts[0];

    const file = new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' });
    quickSplitStore.getState().patchReceipt(receiptId, { receiptFile: file });

    const receipt = quickSplitStore.getState().receipts.find((r) => r.id === receiptId)!;
    expect(receipt.receiptFile).toBe(file);
    expect(receipt.items).toBe(before.items);
    expect(receipt.discount).toBe(before.discount);
    expect(receipt.serviceCharge).toBe(before.serviceCharge);
    expect(receipt.gst).toBe(before.gst);
    expect(receipt.receiptTotalInput).toBe('15.00');
  });

  it('loadWorkspace replaces people, receipts and payer mobile with the loaded split', () => {
    quickSplitStore.getState().addPeople(['Zed']);

    const draft = PRESET_WORKSPACES[1].build();
    quickSplitStore.getState().loadWorkspace(draft);

    const state = quickSplitStore.getState();
    expect(state.people).toHaveLength(12);
    expect(state.receipts.map((receipt) => receipt.name)).toEqual(['Dinner']);
    expect(state.activeReceiptId).toBe(draft.receipts[0].id);
    expect(state.payerMobile).toBe('81234567');
  });

  it('addPeople leaves the split unchanged when every name is already in it', () => {
    quickSplitStore.getState().addPeople(['Alice']);
    const before = quickSplitStore.getState();

    quickSplitStore.getState().addPeople(['alice', ' Alice ']);

    expect(quickSplitStore.getState()).toBe(before);
  });

  it('setReceiptCurrency clears exchangeRateOverride', () => {
    const receiptId = quickSplitStore.getState().activeReceiptId;

    quickSplitStore.getState().patchReceipt(receiptId, { exchangeRateOverride: 1.5 });
    const receiptBefore = quickSplitStore.getState().receipts.find((r) => r.id === receiptId)!;
    expect(receiptBefore.exchangeRateOverride).toBe(1.5);

    quickSplitStore.getState().setReceiptCurrency(receiptId, 'USD');
    const receiptAfter = quickSplitStore.getState().receipts.find((r) => r.id === receiptId)!;
    expect(receiptAfter.currency).toBe('USD');
    expect(receiptAfter.exchangeRateOverride).toBeNull();
  });

  it('removeItem removes an item when receipt has more than one', () => {
    quickSplitStore.getState().addPeople(['Alice']);
    const receiptId = quickSplitStore.getState().activeReceiptId;
    quickSplitStore.getState().addItem(receiptId);

    const items = quickSplitStore.getState().receipts.find((r) => r.id === receiptId)!.items;
    expect(items).toHaveLength(2);

    quickSplitStore.getState().removeItem(receiptId, items[0].id);
    const updatedItems = quickSplitStore.getState().receipts.find((r) => r.id === receiptId)!.items;
    expect(updatedItems).toHaveLength(1);
  });

  it('patchReceipt applies a partial receipt update by id', () => {
    const receiptId = quickSplitStore.getState().activeReceiptId;
    const before = quickSplitStore.getState().receipts[0];
    quickSplitStore.getState().patchReceipt(receiptId, {
      receiptTotalInput: '42.00',
      exchangeRateOverride: 1.35,
      currency: 'USD',
    });

    const receipt = quickSplitStore.getState().receipts.find((r) => r.id === receiptId)!;
    expect(receipt.receiptTotalInput).toBe('42.00');
    expect(receipt.exchangeRateOverride).toBe(1.35);
    expect(receipt.currency).toBe('USD');
    expect(receipt.items).toBe(before.items);
    expect(receipt.serviceCharge).toBe(before.serviceCharge);
  });

  it('patchReceipt leaves the other receipts as they were', () => {
    quickSplitStore.getState().addReceipt();
    const [first, second] = quickSplitStore.getState().receipts;

    quickSplitStore.getState().patchReceipt(first.id, { receiptTotalInput: '42.00' });

    expect(quickSplitStore.getState().receipts[1]).toBe(second);
  });

  it('addItem, updateItem and removeItem act on the named receipt, not the active one', () => {
    const firstId = quickSplitStore.getState().activeReceiptId;
    quickSplitStore.getState().addReceipt();
    const second = quickSplitStore.getState().receipts[1];
    expect(quickSplitStore.getState().activeReceiptId).toBe(second.id);

    quickSplitStore.getState().addItem(firstId);
    const [kept, added] = quickSplitStore.getState().receipts[0].items;
    quickSplitStore.getState().updateItem(firstId, added.id, (item) => ({ ...item, name: 'Tea' }));
    quickSplitStore.getState().removeItem(firstId, kept.id);

    expect(quickSplitStore.getState().receipts[0].items.map((item) => item.name)).toEqual(['Tea']);
    expect(quickSplitStore.getState().receipts[1]).toBe(second);
  });

  it('updateItems rewrites the named receipt with the people in the split', () => {
    const people: Person[] = [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' },
    ];
    const receipts: [Receipt, Receipt] = [
      {
        id: 'r1',
        name: 'Receipt 1',
        items: [
          {
            id: 'r1-unassigned',
            name: 'Unassigned',
            amountInput: '10.00',
            discountPercentInput: '',
            assignment: NOBODY,
          },
        ],
        discount: { ...defaultDiscountState },
        serviceCharge: { ...defaultServiceChargeState },
        gst: { ...defaultGstState },
        receiptTotalInput: '',
        roundingInput: '',
        currency: 'SGD',
        exchangeRateOverride: null,
      },
      {
        id: 'r2',
        name: 'Receipt 2',
        items: [
          {
            id: 'r2-unassigned',
            name: 'Other receipt item',
            amountInput: '12.00',
            discountPercentInput: '',
            assignment: NOBODY,
          },
        ],
        discount: { ...defaultDiscountState },
        serviceCharge: { ...defaultServiceChargeState },
        gst: { ...defaultGstState },
        receiptTotalInput: '',
        roundingInput: '',
        currency: 'SGD',
        exchangeRateOverride: null,
      },
    ];
    quickSplitStore.setState({
      people,
      receipts,
      activeReceiptId: 'r1',
    });

    quickSplitStore.getState().updateItems('r2', splitUnassignedItemsEqually);

    const state = quickSplitStore.getState();
    expect(state.receipts[0]).toBe(receipts[0]);
    expect(state.receipts[1].items[0].assignment).toEqual(equalShares(['p1', 'p2']));
  });
});

describe('equal sharing on a chosen receipt', () => {
  it('replaces existing weights on the chosen receipt and preserves other receipts', () => {
    const receipt = makeReceipt({
      id: 'r1',
      items: [
        makeItem({
          id: 'i1',
          assignment: makeAssignment({ p1: 2 }, 1),
        }),
      ],
    });
    quickSplitStore.setState({
      people: [
        { id: 'p1', name: 'Ana' },
        { id: 'p2', name: 'Ben' },
      ],
      receipts: [receipt, { ...receipt, id: 'r2' }],
      activeReceiptId: 'r2',
    });

    quickSplitStore.getState().updateItems('r1', assignEveryItemEqually);

    expect(quickSplitStore.getState().receipts[0].items[0].assignment).toEqual(
      equalShares(['p1', 'p2']),
    );
    expect(quickSplitStore.getState().receipts[1]).toEqual({ ...receipt, id: 'r2' });
  });

  it('selects and deselects one person on every item of the named receipt only', () => {
    const receipt = makeReceipt({
      id: 'r1',
      items: [
        makeItem({ id: 'i1', assignment: NOBODY }),
        makeItem({ id: 'i2', assignment: equalShares(['p1']) }),
      ],
    });
    quickSplitStore.setState({
      people: [
        { id: 'p1', name: 'Ana' },
        { id: 'p2', name: 'Ben' },
      ],
      receipts: [receipt, { ...receipt, id: 'r2' }],
      activeReceiptId: 'r2',
    });
    const personIdsOf = (index: number) =>
      quickSplitStore
        .getState()
        .receipts[index].items.map((item) => Object.keys(item.assignment.shares));

    quickSplitStore
      .getState()
      .updateItems('r1', (items) => setPersonOnEveryItem(items, 'p2', true));
    expect(personIdsOf(0)).toEqual([['p2'], ['p1', 'p2']]);
    expect(personIdsOf(1)).toEqual([[], ['p1']]);

    quickSplitStore
      .getState()
      .updateItems('r1', (items) => setPersonOnEveryItem(items, 'p2', false));
    expect(personIdsOf(0)).toEqual([[], ['p1']]);
  });

  it('changes nothing when the named receipt does not exist', () => {
    const receipt = makeReceipt({
      id: 'r1',
      items: [
        makeItem({
          id: 'i1',
          assignment: NOBODY,
        }),
      ],
    });
    quickSplitStore.setState({
      people: [
        { id: 'p1', name: 'Ana' },
        { id: 'p2', name: 'Ben' },
      ],
      receipts: [receipt],
      activeReceiptId: 'missing',
    });

    quickSplitStore.getState().updateItems('missing', assignEveryItemEqually);

    expect(quickSplitStore.getState().receipts).toEqual([receipt]);
  });
});

describe('workspaces under their own keys', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const alice: Person = { id: 'alice', name: 'Alice' };
  const bob: Person = { id: 'bob', name: 'Bob' };

  it('saves a scoped workspace under its key and leaves the quick split draft alone', () => {
    quickSplitStore.getState().addPeople(['Quinn']);
    const quickSplitDraft = window.localStorage.getItem(LOCAL_STORAGE_DRAFT_KEY);

    const store = createWorkspaceStore({ draftKey: 'test:draft', wizardKey: 'test:wizard' });
    store.getState().addPeople(['Alice']);

    expect(window.localStorage.getItem(LOCAL_STORAGE_DRAFT_KEY)).toBe(quickSplitDraft);
    expect(loadPersistedDraft('test:draft')?.people.map((person) => person.name)).toEqual([
      'Alice',
    ]);
    expect(quickSplitStore.getState().people.map((person) => person.name)).toEqual(['Quinn']);
  });

  it('starts from the initial workspace when nothing is saved under its key', () => {
    const receipt = makeReceipt({ id: 'r1', name: 'Dinner' });
    const store = createWorkspaceStore({
      draftKey: 'test:draft',
      wizardKey: 'test:wizard',
      initial: { people: [alice], receipts: [receipt], activeReceiptId: 'r1', payerMobile: '' },
    });

    expect(store.getState().receipts.map((candidate) => candidate.name)).toEqual(['Dinner']);
    expect(store.getState().people).toEqual([alice]);
  });

  it('resumes what is saved under its key over the initial workspace', () => {
    const first = createWorkspaceStore({ draftKey: 'test:draft', wizardKey: 'test:wizard' });
    first.getState().renameReceipt(first.getState().activeReceiptId, 'Saved');

    const store = createWorkspaceStore({
      draftKey: 'test:draft',
      wizardKey: 'test:wizard',
      initial: {
        people: [],
        receipts: [makeReceipt({ id: 'r1', name: 'Initial' })],
        activeReceiptId: 'r1',
        payerMobile: '',
      },
    });

    expect(store.getState().receipts[0].name).toBe('Saved');
  });

  it('takes the fixed people over the saved ones and drops shares of anyone gone', () => {
    const receipt = makeReceipt({
      id: 'r1',
      items: [makeItem({ id: 'i1', assignment: equalShares(['alice', 'bob']) })],
    });
    createWorkspaceStore({
      draftKey: 'test:draft',
      wizardKey: 'test:wizard',
      initial: {
        people: [alice, bob],
        receipts: [receipt],
        activeReceiptId: 'r1',
        payerMobile: '',
      },
    })
      .getState()
      .setPayerMobile('91234567');

    const store = createWorkspaceStore({
      draftKey: 'test:draft',
      wizardKey: 'test:wizard',
      people: [alice],
    });

    expect(store.getState().people).toEqual([alice]);
    expect(store.getState().receipts[0].items[0].assignment).toEqual(equalShares(['alice']));
  });
});
