import { act, renderHook } from '@testing-library/react';
import {
  LOCAL_STORAGE_WIZARD_STATE_KEY,
  LOCAL_STORAGE_DRAFT_KEY,
} from '@features/split-workspace/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OcrResponse } from '@shared/types';
import { analyzeReceiptWithGemini } from '@features/receipt-scanner/api/geminiApi';
import { getScanState, useScanStore } from '@features/receipt-scanner/stores/scanStore';
import { DEFAULT_GEMINI_MODEL } from '@features/receipt-scanner/constants';
import { useReceiptImport } from '@features/split-workspace/components/steps/ReceiptStep/useReceiptImport';
import { useSplits } from '@features/split-workspace/hooks/useSplits';
import { useWizard } from '@features/split-workspace/hooks/useWizard';
import { loadPersistedDraft } from '@features/split-workspace/logic/draftStorage';
import { loadWizardState, saveWizardState } from '@features/split-workspace/logic/persistence';
import { useGeminiStore } from '@features/split-workspace/stores/geminiStore';
import { useReceiptStore, quickSplitStore } from '@features/split-workspace/stores/receiptStore';
import {
  makeItem,
  makePerson,
  makeReceipt,
  reloadWorkspace,
  resetAllStores,
  seedStore,
} from './testHelpers';
import { equalShares } from '@features/split-workspace/logic/assignment';

vi.mock('@features/receipt-scanner/api/geminiApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@features/receipt-scanner/api/geminiApi')>();
  return { ...actual, analyzeReceiptWithGemini: vi.fn() };
});

const scanApiMock = vi.mocked(analyzeReceiptWithGemini);

function seedSavedBill() {
  const alice = makePerson('Alice');
  seedStore(
    [alice],
    [
      makeReceipt({
        id: 'dinner-a',
        name: 'Dinner A',
        items: [
          makeItem({
            id: 'meal-a',
            name: 'Dinner A meal',
            amountInput: '5.00',
            assignment: equalShares([alice.id]),
          }),
        ],
        receiptTotalInput: '5.00',
      }),
    ],
  );
  quickSplitStore.getState().setPayerMobile('91234567');
  useGeminiStore.setState({ geminiApiKeyInput: 'saved-key' });
  saveWizardState(LOCAL_STORAGE_WIZARD_STATE_KEY, {
    step: 'final',
    activePersonId: '',
    assignMode: 'person',
  });
}

function renderWorkspaceHooks() {
  return renderHook(() => {
    const state = useReceiptStore((state) => state);
    const wizard = useWizard(
      state.receipts.find((receipt) => receipt.id === state.activeReceiptId)?.items ?? [],
      state.people,
      state.receipts,
    );
    const receiptImport = useReceiptImport({ activeReceiptId: state.activeReceiptId });
    const splits = useSplits();
    return { wizard, receiptImport, splits };
  });
}

function scannedBill(): OcrResponse {
  return {
    items: [{ description: 'Old scan meal', amount: 12 }],
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
    warnings: ['Old scan warning'],
  };
}

describe('workspace recovery', () => {
  beforeEach(() => {
    resetAllStores();
    window.localStorage.clear();
    window.sessionStorage.clear();
    scanApiMock.mockReset();
  });

  it('restores the saved bill after selecting a replacement file and a failed scan', async () => {
    seedSavedBill();
    scanApiMock.mockRejectedValue(new Error('Connection failed'));
    const { result, unmount } = renderWorkspaceHooks();

    act(() =>
      result.current.receiptImport.handleReceiptFileChange(
        new File(['image'], 'new.jpg', { type: 'image/jpeg' }),
      ),
    );
    await act(async () => result.current.receiptImport.handleScanReceipt());

    expect(loadPersistedDraft(LOCAL_STORAGE_DRAFT_KEY)?.receipts[0].items[0].amountInput).toBe(
      '5.00',
    );
    expect(loadPersistedDraft(LOCAL_STORAGE_DRAFT_KEY)?.receipts[0].receiptTotalInput).toBe('5.00');
    expect(useScanStore.getState().scanStateByReceipt['dinner-a'].scanError).toBe(
      'Connection failed',
    );
    unmount();
    reloadWorkspace();

    const restored = quickSplitStore.getState();
    expect(restored.receipts[0].name).toBe('Dinner A');
    expect(restored.receipts[0].items[0].name).toBe('Dinner A meal');
    expect(restored.receipts[0].items[0].amountInput).toBe('5.00');
    expect(restored.receipts[0].receiptFile).toBeUndefined();
    expect(restored.payerMobile).toBe('91234567');
  });

  it('keeps a reset split safe from an old scan, then saves and restores the next bill', async () => {
    seedSavedBill();
    const deferred = Promise.withResolvers<OcrResponse>();
    scanApiMock.mockReturnValue(deferred.promise);
    const { result, unmount } = renderWorkspaceHooks();
    act(() =>
      result.current.receiptImport.handleReceiptFileChange(
        new File(['image'], 'old.jpg', { type: 'image/jpeg' }),
      ),
    );
    let scanPromise: Promise<void> = Promise.resolve();
    act(() => {
      scanPromise = result.current.receiptImport.handleScanReceipt();
    });
    expect(useScanStore.getState().scanStateByReceipt['dinner-a'].isScanning).toBe(true);

    act(() => result.current.wizard.handleResetSplit());

    const freshReceiptId = quickSplitStore.getState().activeReceiptId;
    expect(freshReceiptId).not.toBe('dinner-a');
    expect(loadPersistedDraft(LOCAL_STORAGE_DRAFT_KEY)?.people).toEqual([]);
    expect(loadPersistedDraft(LOCAL_STORAGE_DRAFT_KEY)?.receipts).toHaveLength(1);
    expect(loadPersistedDraft(LOCAL_STORAGE_DRAFT_KEY)?.receipts[0].id).toBe(freshReceiptId);
    expect(loadPersistedDraft(LOCAL_STORAGE_DRAFT_KEY)?.payerMobile).toBe('');
    expect(loadWizardState(LOCAL_STORAGE_WIZARD_STATE_KEY)).toEqual({
      version: 1,
      step: 'people',
      activePersonId: '',
      assignMode: 'person',
    });
    expect(useScanStore.getState().scanStateByReceipt).toEqual({});
    expect(useGeminiStore.getState().geminiApiKeyInput).toBe('saved-key');
    expect(useGeminiStore.getState().geminiModel).toBe(DEFAULT_GEMINI_MODEL);

    await act(async () => {
      deferred.resolve(scannedBill());
      await scanPromise;
    });

    expect(quickSplitStore.getState().receipts[0].items[0].amountInput).toBe('');
    expect(quickSplitStore.getState().activeReceiptId).toBe(freshReceiptId);
    expect(
      getScanState(useScanStore.getState().scanStateByReceipt, freshReceiptId).scanWarnings,
    ).toEqual([]);
    expect(
      getScanState(useScanStore.getState().scanStateByReceipt, freshReceiptId).scanError,
    ).toBeNull();

    act(() => {
      quickSplitStore.getState().addPeople(['Bob']);
      const state = quickSplitStore.getState();
      const [receipt] = state.receipts;
      quickSplitStore.getState().updateItem(receipt.id, receipt.items[0].id, (item) => ({
        ...item,
        name: 'Dinner B meal',
        amountInput: '20.00',
        assignment: equalShares([state.people[0].id]),
      }));
    });
    expect(result.current.splits.receiptSplits[0].split.totals.totalCents).toBe(2398);
    unmount();
    reloadWorkspace();

    const restored = quickSplitStore.getState();
    expect(restored.receipts).toHaveLength(1);
    expect(restored.receipts[0].id).toBe(freshReceiptId);
    expect(restored.receipts[0].items[0].name).toBe('Dinner B meal');
    expect(restored.receipts[0].items[0].amountInput).toBe('20.00');
    expect(restored.people.map((person) => person.name)).toEqual(['Bob']);
    expect(restored.payerMobile).toBe('');
  });
});
