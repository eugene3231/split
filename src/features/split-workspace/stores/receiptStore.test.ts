import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GEMINI_MODEL } from '@features/receipt-scanner/constants';
import {
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
  LOCAL_STORAGE_OCR_SETTINGS_KEY,
  SESSION_STORAGE_GEMINI_API_KEY,
} from '@features/split-workspace/constants';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { useScanStore } from '@features/receipt-scanner/stores/scanStore';
import { useGeminiStore } from '@features/split-workspace/stores/geminiStore';
import type { Person, Receipt } from '@shared/types';

const FIRST_LOADING_MESSAGE = 'Asking Gemini to decipher cryptic cashier handwriting...';
const SECOND_LOADING_MESSAGE = 'Negotiating with suspiciously smudged totals...';

const TEST_RECEIPT_ID = 'test-receipt-1';

function resetStore() {
  useReceiptStore.setState({
    peopleInput: '',
    initialized: false,
    people: [],
    receipts: [],
    activeReceiptId: '',
  });
  useScanStore.setState({ scanStateByReceipt: {} });
  useGeminiStore.setState({
    geminiApiKeyInput: '',
    rememberGeminiApiKey: false,
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
    expect(scanState.scanStatus).toBe('Preparing Gemini request...');
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
          scanStatus: '',
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
    expect(scanState.scanStatus).toBe('');
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
          scanStatus: 'Calling Gemini...',
          scanError: 'boom',
          scanWarnings: ['low confidence'],
          loadingMessage: 'Working...',
          loadingMessageIndex: 3,
        },
      },
    });

    useScanStore.getState().clearScanFeedback(TEST_RECEIPT_ID);
    const scanState = useScanStore.getState().scanStateByReceipt[TEST_RECEIPT_ID];

    expect(scanState.scanStatus).toBe('');
    expect(scanState.scanError).toBeNull();
    expect(scanState.scanWarnings).toEqual([]);
    expect(scanState.loadingMessage).toBe('');
    expect(scanState.loadingMessageIndex).toBe(0);

    expect(scanState.isScanning).toBe(true);
  });

  it('setScanStatus/setScanError/setScanWarnings support value and updater forms', () => {
    useScanStore.getState().setScanStatus(TEST_RECEIPT_ID, 'Encoding receipt...');
    useScanStore.getState().setScanStatus(TEST_RECEIPT_ID, (current) => `${current} done`);

    useScanStore.getState().setScanError(TEST_RECEIPT_ID, 'first');
    useScanStore
      .getState()
      .setScanError(TEST_RECEIPT_ID, (current) => (current ? `${current}!` : current));

    useScanStore.getState().setScanWarnings(TEST_RECEIPT_ID, ['a']);
    useScanStore.getState().setScanWarnings(TEST_RECEIPT_ID, (current) => [...current, 'b']);

    const scanState = useScanStore.getState().scanStateByReceipt[TEST_RECEIPT_ID];
    expect(scanState.scanStatus).toBe('Encoding receipt... done');
    expect(scanState.scanError).toBe('first!');
    expect(scanState.scanWarnings).toEqual(['a', 'b']);
  });

  it('persists gemini model changes through the store action', () => {
    useGeminiStore.getState().setGeminiModel('gemini-3.7-flash');

    expect(useGeminiStore.getState().geminiModel).toBe('gemini-3.7.flash');
    expect(window.localStorage.getItem(LOCAL_STORAGE_OCR_SETTINGS_KEY)).toContain(
      '"geminiModel":"gemini-3.7-flash"',
    );
  });

  it('persists and clears the session gemini api key through store actions', () => {
    useGeminiStore.getState().setRememberGeminiApiKey(true);
    useGeminiStore.getState().setGeminiApiKeyInput('session-key');
    expect(window.sessionStorage.getItem(SESSION_STORAGE_GEMINI_API_KEY)).toBe('session-key');

    useGeminiStore.getState().setGeminiApiKeyInput('');
    expect(window.sessionStorage.getItem(SESSION_STORAGE_GEMINI_API_KEY)).toBeNull();

    useGeminiStore.getState().setGeminiApiKeyInput('session-key');
    useGeminiStore.getState().setRememberGeminiApiKey(false);
    expect(window.sessionStorage.getItem(SESSION_STORAGE_GEMINI_API_KEY)).toBeNull();
  });
});

describe('receipt management', () => {
  it('addReceipt creates a new receipt and activates it', () => {
    useReceiptStore.getState().initialize();
    expect(useReceiptStore.getState().receipts).toHaveLength(1);

    useReceiptStore.getState().addReceipt();
    const state = useReceiptStore.getState();

    expect(state.receipts).toHaveLength(2);
    expect(state.activeReceiptId).toBe(state.receipts[1].id);
    expect(state.receipts[1].name).toBe('Receipt 2');
  });

  it('removeReceipt removes a receipt and updates activeReceiptId', () => {
    useReceiptStore.getState().initialize();
    useReceiptStore.getState().addReceipt();

    const stateBefore = useReceiptStore.getState();
    const firstId = stateBefore.receipts[0].id;
    const secondId = stateBefore.receipts[1].id;
    expect(stateBefore.activeReceiptId).toBe(secondId);

    useReceiptStore.getState().removeReceipt(secondId);
    const state = useReceiptStore.getState();

    expect(state.receipts).toHaveLength(1);
    expect(state.activeReceiptId).toBe(firstId);
  });

  it('removeReceipt does not remove the last remaining receipt', () => {
    useReceiptStore.getState().initialize();
    const receiptId = useReceiptStore.getState().receipts[0].id;

    useReceiptStore.getState().removeReceipt(receiptId);

    expect(useReceiptStore.getState().receipts).toHaveLength(1);
  });

  it('setActiveReceiptId switches the active receipt', () => {
    useReceiptStore.getState().initialize();
    useReceiptStore.getState().addReceipt();

    const firstId = useReceiptStore.getState().receipts[0].id;
    useReceiptStore.getState().setActiveReceiptId(firstId);

    expect(useReceiptStore.getState().activeReceiptId).toBe(firstId);
  });

  it('setActiveReceiptId ignores unknown receipt ids', () => {
    useReceiptStore.getState().initialize();
    const currentId = useReceiptStore.getState().activeReceiptId;

    useReceiptStore.getState().setActiveReceiptId('nonexistent-id');

    expect(useReceiptStore.getState().activeReceiptId).toBe(currentId);
  });

  it('renameReceipt updates the receipt name', () => {
    useReceiptStore.getState().initialize();
    const receiptId = useReceiptStore.getState().receipts[0].id;

    useReceiptStore.getState().renameReceipt(receiptId, 'Dinner at Mario');
    const receipt = useReceiptStore.getState().receipts.find((r) => r.id === receiptId);

    expect(receipt?.name).toBe('Dinner at Mario');
  });

  it('renameReceipt ignores blank names', () => {
    useReceiptStore.getState().initialize();
    const receiptId = useReceiptStore.getState().receipts[0].id;
    const originalName = useReceiptStore.getState().receipts[0].name;

    useReceiptStore.getState().renameReceipt(receiptId, '   ');
    const receipt = useReceiptStore.getState().receipts.find((r) => r.id === receiptId);

    expect(receipt?.name).toBe(originalName);
  });
});

describe('receiptStore additional coverage', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initialize is a no-op on second call', () => {
    useReceiptStore.getState().initialize();
    const firstState = useReceiptStore.getState();
    const receiptId = firstState.receipts[0].id;

    useReceiptStore.getState().addPeopleFromInput('Alice');
    useReceiptStore.getState().initialize();

    expect(useReceiptStore.getState().people).toHaveLength(1);
    expect(useReceiptStore.getState().receipts[0].id).toBe(receiptId);
  });

  it('addPeopleFromInput does nothing for empty input', () => {
    useReceiptStore.getState().initialize();
    useReceiptStore.getState().addPeopleFromInput('   ');
    expect(useReceiptStore.getState().people).toHaveLength(0);
  });

  it('addPeopleFromInput skips duplicates', () => {
    useReceiptStore.getState().initialize();
    useReceiptStore.getState().addPeopleFromInput('Alice');
    expect(useReceiptStore.getState().people).toHaveLength(1);

    useReceiptStore.getState().addPeopleFromInput('Alice, Bob');
    expect(useReceiptStore.getState().people).toHaveLength(2);
  });

  it('removeItem is a no-op when only one item remains', () => {
    useReceiptStore.getState().initialize();
    const receiptId = useReceiptStore.getState().activeReceiptId;
    const itemId = useReceiptStore.getState().receipts.find((r) => r.id === receiptId)!.items[0].id;

    useReceiptStore.getState().removeItem(itemId);
    const items = useReceiptStore.getState().receipts.find((r) => r.id === receiptId)!.items;
    expect(items).toHaveLength(1);
  });

  it('setServiceCharge updates the active receipt', () => {
    useReceiptStore.getState().initialize();
    const receiptId = useReceiptStore.getState().activeReceiptId;

    useReceiptStore.getState().setServiceCharge({
      enabled: true,
      mode: 'percent',
      amountInput: '',
      percentInput: '15',
      detectedConfidence: null,
      detectedSource: null,
    });

    const receipt = useReceiptStore.getState().receipts.find((r) => r.id === receiptId)!;
    expect(receipt.serviceCharge.percentInput).toBe('15');
  });

  it('setGst updates the active receipt', () => {
    useReceiptStore.getState().initialize();

    useReceiptStore.getState().setGst({
      enabled: false,
      mode: 'percent',
      amountInput: '',
      percentInput: '',
      detectedConfidence: null,
      detectedSource: null,
    });

    const receipt = useReceiptStore.getState().receipts[0];
    expect(receipt.gst.enabled).toBe(false);
  });

  it('setReceiptTotalInput updates the active receipt', () => {
    useReceiptStore.getState().initialize();

    useReceiptStore.getState().setReceiptTotalInput('99.50');
    expect(useReceiptStore.getState().receipts[0].receiptTotalInput).toBe('99.50');
  });

  it('handleReceiptFileSelected resets receipt draft fields', () => {
    useReceiptStore.getState().initialize();
    const receiptId = useReceiptStore.getState().activeReceiptId;

    useScanStore.getState().setScanError(receiptId, 'old error');

    const file = new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' });
    useReceiptStore.getState().handleReceiptFileSelected(file);

    const receipt = useReceiptStore.getState().receipts.find((r) => r.id === receiptId)!;
    expect(receipt.receiptFile).toBe(file);
    expect(receipt.items).toHaveLength(1);
    expect(receipt.serviceCharge.enabled).toBe(true);
    expect(receipt.gst.enabled).toBe(true);
    expect(receipt.receiptTotalInput).toBe('');
  });

  it('handleReceiptFileSelected clears receiptFile when null is passed', () => {
    useReceiptStore.getState().initialize();
    const receiptId = useReceiptStore.getState().activeReceiptId;

    const file = new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' });
    useReceiptStore.getState().handleReceiptFileSelected(file);
    expect(useReceiptStore.getState().receipts[0].receiptFile).toBe(file);

    useReceiptStore.getState().handleReceiptFileSelected(null);
    expect(
      useReceiptStore.getState().receipts.find((r) => r.id === receiptId)!.receiptFile,
    ).toBeNull();
  });

  it('importFromJson ignores invalid JSON', () => {
    useReceiptStore.getState().initialize();
    useReceiptStore.getState().addPeopleFromInput('Alice');

    useReceiptStore.getState().importFromJson('not valid json');
    expect(useReceiptStore.getState().people).toHaveLength(1);
  });

  it('importFromJson ignores malformed draft', () => {
    useReceiptStore.getState().initialize();
    useReceiptStore.getState().addPeopleFromInput('Alice');

    useReceiptStore.getState().importFromJson(JSON.stringify({ version: 999 }));
    expect(useReceiptStore.getState().people).toHaveLength(1);
  });

  it('setReceiptExchangeRateOverride updates the correct receipt', () => {
    useReceiptStore.getState().initialize();
    const receiptId = useReceiptStore.getState().activeReceiptId;

    useReceiptStore.getState().setReceiptExchangeRateOverride(receiptId, 1.35);
    const receipt = useReceiptStore.getState().receipts.find((r) => r.id === receiptId)!;
    expect(receipt.exchangeRateOverride).toBe(1.35);

    useReceiptStore.getState().setReceiptExchangeRateOverride(receiptId, null);
    expect(
      useReceiptStore.getState().receipts.find((r) => r.id === receiptId)!.exchangeRateOverride,
    ).toBeNull();
  });

  it('addPeopleFromInput returns unchanged state when all names are duplicates', () => {
    useReceiptStore.getState().initialize();
    useReceiptStore.getState().addPeopleFromInput('Alice');
    expect(useReceiptStore.getState().people).toHaveLength(1);

    useReceiptStore.getState().addPeopleFromInput('Alice');
    expect(useReceiptStore.getState().people).toHaveLength(1);
  });

  it('setReceiptCurrency clears exchangeRateOverride', () => {
    useReceiptStore.getState().initialize();
    const receiptId = useReceiptStore.getState().activeReceiptId;

    useReceiptStore.getState().setReceiptExchangeRateOverride(receiptId, 1.5);
    const receiptBefore = useReceiptStore.getState().receipts.find((r) => r.id === receiptId)!;
    expect(receiptBefore.exchangeRateOverride).toBe(1.5);

    useReceiptStore.getState().setReceiptCurrency(receiptId, 'USD');
    const receiptAfter = useReceiptStore.getState().receipts.find((r) => r.id === receiptId)!;
    expect(receiptAfter.currency).toBe('USD');
    expect(receiptAfter.exchangeRateOverride).toBeNull();
  });

  it('removeItem removes an item when receipt has more than one', () => {
    useReceiptStore.getState().initialize();
    useReceiptStore.getState().addPeopleFromInput('Alice');
    useReceiptStore.getState().addItem();

    const receiptId = useReceiptStore.getState().activeReceiptId;
    const items = useReceiptStore.getState().receipts.find((r) => r.id === receiptId)!.items;
    expect(items).toHaveLength(2);

    useReceiptStore.getState().removeItem(items[0].id);
    const updatedItems = useReceiptStore.getState().receipts.find((r) => r.id === receiptId)!.items;
    expect(updatedItems).toHaveLength(1);
  });

  it('setPayerMobile updates payer mobile', () => {
    useReceiptStore.getState().initialize();
    useReceiptStore.getState().setPayerMobile('+6591234567');
    expect(useReceiptStore.getState().payerMobile).toBe('+6591234567');
  });

  it('patchReceipt applies a partial receipt update by id', () => {
    useReceiptStore.getState().initialize();
    const receiptId = useReceiptStore.getState().activeReceiptId;
    useReceiptStore.getState().patchReceipt(receiptId, {
      receiptTotalInput: '42.00',
      currency: 'USD',
    });

    const receipt = useReceiptStore.getState().receipts.find((r) => r.id === receiptId)!;
    expect(receipt.receiptTotalInput).toBe('42.00');
    expect(receipt.currency).toBe('USD');
  });

  it('splitUnassignedItemsEquallyForActiveReceipt updates only the active receipt', () => {
    const people: Person[] = [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' },
    ];
    const receipts: Receipt[] = [
      {
        id: 'r1',
        name: 'Receipt 1',
        items: [
          {
            id: 'r1-unassigned',
            name: 'Unassigned',
            amountInput: '10.00',
            discountPercentInput: '',
            assignment: { mode: 'equal', personId: '', personIds: [] },
          },
        ],
        discount: { ...defaultDiscountState },
        serviceCharge: { ...defaultServiceChargeState },
        gst: { ...defaultGstState },
        receiptTotalInput: '',
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
            assignment: { mode: 'equal', personId: '', personIds: [] },
          },
        ],
        discount: { ...defaultDiscountState },
        serviceCharge: { ...defaultServiceChargeState },
        gst: { ...defaultGstState },
        receiptTotalInput: '',
        currency: 'SGD',
        exchangeRateOverride: null,
      },
    ];
    useReceiptStore.setState({
      initialized: true,
      people,
      receipts,
      activeReceiptId: 'r1',
    });

    useReceiptStore.getState().splitUnassignedItemsEquallyForActiveReceipt();

    const state = useReceiptStore.getState();
    expect(state.receipts[0].items[0].assignment.personIds).toEqual(['p1', 'p2']);
    expect(state.receipts[1]).toBe(receipts[1]);
    expect(state.receipts[1].items[0].assignment.personIds).toEqual([]);
  });
});
