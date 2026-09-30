import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OcrResponse } from '@shared/types';
import { analyzeReceiptWithGemini } from '@features/receipt-scanner/api/geminiApi';
import { getScanState, useScanStore } from '@features/receipt-scanner/stores/scanStore';
import { DEFAULT_GEMINI_MODEL } from '@features/receipt-scanner/constants';
import { useReceiptImport } from '@features/split-workspace/components/steps/ReceiptStep/useReceiptImport';
import { useDraftPersistence } from '@features/split-workspace/hooks/useDraftPersistence';
import { useReceiptSplit } from '@features/split-workspace/hooks/useReceiptSplit';
import { useWizard } from '@features/split-workspace/hooks/useWizard';
import { loadPersistedDraft } from '@features/split-workspace/logic/draftStorage';
import { loadWizardState, saveWizardState } from '@features/split-workspace/logic/persistence';
import { useGeminiStore } from '@features/split-workspace/stores/geminiStore';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { makeItem, makePerson, makeReceipt, resetAllStores, seedStore } from './testHelpers';

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
            assignment: { mode: 'equal', personId: '', personIds: [alice.id] },
          }),
        ],
        receiptTotalInput: '5.00',
      }),
    ],
  );
  useReceiptStore.getState().setPayerMobile('91234567');
  useGeminiStore.setState({ geminiApiKeyInput: 'saved-key', rememberGeminiApiKey: true });
  saveWizardState({ step: 'final', itemsSubPhase: 'review', activeItemIndex: 0 });
}

function renderWorkspaceHooks() {
  return renderHook(() => {
    const state = useReceiptStore();
    useDraftPersistence(state);
    const wizard = useWizard(
      state.receipts.find((receipt) => receipt.id === state.activeReceiptId)?.items ?? [],
      state.people,
      state.normalizeItems,
      state.receipts,
      state.activeReceiptId,
      state.setActiveReceiptId,
    );
    const receiptImport = useReceiptImport({ activeReceiptId: state.activeReceiptId });
    const split = useReceiptSplit();
    return { wizard, receiptImport, split };
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

    expect(loadPersistedDraft()?.receipts[0].items[0].amountInput).toBe('5.00');
    expect(loadPersistedDraft()?.receipts[0].receiptTotalInput).toBe('5.00');
    expect(useScanStore.getState().scanStateByReceipt['dinner-a'].scanError).toBe(
      'Connection failed',
    );
    unmount();
    useReceiptStore.getState().reset();
    useReceiptStore.getState().initialize();

    const restored = useReceiptStore.getState();
    expect(restored.receipts[0].name).toBe('Dinner A');
    expect(restored.receipts[0].items[0].name).toBe('Dinner A meal');
    expect(restored.receipts[0].items[0].amountInput).toBe('5.00');
    expect(restored.receipts[0].receiptFile).toBeUndefined();
    expect(restored.payerMobile).toBe('91234567');
  });

  it('keeps a new split safe from an old scan, then saves and restores the next bill', async () => {
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

    act(() => result.current.wizard.handleNewSplit());

    const freshReceiptId = useReceiptStore.getState().activeReceiptId;
    expect(freshReceiptId).not.toBe('dinner-a');
    expect(loadPersistedDraft()?.people).toEqual([]);
    expect(loadPersistedDraft()?.receipts).toHaveLength(1);
    expect(loadPersistedDraft()?.receipts[0].id).toBe(freshReceiptId);
    expect(loadPersistedDraft()?.payerMobile).toBe('');
    expect(loadWizardState()).toMatchObject({
      step: 'people',
      itemsSubPhase: 'assign',
      activeItemIndex: 0,
    });
    expect(useScanStore.getState().scanStateByReceipt).toEqual({});
    expect(useGeminiStore.getState().geminiApiKeyInput).toBe('saved-key');
    expect(useGeminiStore.getState().rememberGeminiApiKey).toBe(true);
    expect(useGeminiStore.getState().geminiModel).toBe(DEFAULT_GEMINI_MODEL);

    await act(async () => {
      deferred.resolve(scannedBill());
      await scanPromise;
    });

    expect(useReceiptStore.getState().receipts[0].items[0].amountInput).toBe('');
    expect(useReceiptStore.getState().activeReceiptId).toBe(freshReceiptId);
    expect(
      getScanState(useScanStore.getState().scanStateByReceipt, freshReceiptId).scanWarnings,
    ).toEqual([]);
    expect(
      getScanState(useScanStore.getState().scanStateByReceipt, freshReceiptId).scanError,
    ).toBeNull();

    act(() => {
      useReceiptStore.getState().addPeopleFromInput('Bob');
      const state = useReceiptStore.getState();
      const itemId = state.receipts[0].items[0].id;
      useReceiptStore.getState().updateItem(itemId, (item) => ({
        ...item,
        name: 'Dinner B meal',
        amountInput: '20.00',
        assignment: { mode: 'equal', personId: '', personIds: [state.people[0].id] },
      }));
    });
    expect(result.current.split.active.split.grandTotalCents).toBe(2398);
    unmount();
    useReceiptStore.getState().reset();
    useReceiptStore.getState().initialize();

    const restored = useReceiptStore.getState();
    expect(restored.receipts).toHaveLength(1);
    expect(restored.receipts[0].id).toBe(freshReceiptId);
    expect(restored.receipts[0].items[0].name).toBe('Dinner B meal');
    expect(restored.receipts[0].items[0].amountInput).toBe('20.00');
    expect(restored.people.map((person) => person.name)).toEqual(['Bob']);
    expect(restored.payerMobile).toBe('');
  });
});
