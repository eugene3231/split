import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OcrResponse } from '@shared/types';
import { analyzeReceiptWithGemini } from '@features/receipt-scanner/api/geminiApi';
import { useScanStore } from '@features/receipt-scanner/stores/scanStore';
import { GeminiApiKeyModal } from '@features/split-workspace/components/GeminiApiKeyModal';
import { useGeminiStore } from '@features/split-workspace/stores/geminiStore';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { useReceiptImport } from '@features/split-workspace/components/steps/ReceiptStep/useReceiptImport';
import {
  makeItem,
  makeReceipt,
  resetAllStores,
  seedStore,
} from '../../../tests/integration/testHelpers';

vi.mock('@features/receipt-scanner/api/geminiApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@features/receipt-scanner/api/geminiApi')>();
  return { ...actual, analyzeReceiptWithGemini: vi.fn() };
});

const directScan = vi.mocked(analyzeReceiptWithGemini);

const receipt: OcrResponse = {
  items: [{ description: 'Nasi Lemak', amount: 12.5 }],
  subtotal: 12.5,
  total: 12.5,
  detected: {
    gst: { enabled: false, amount: null, percent: null, confidence: null, source: '' },
    serviceCharge: { enabled: false, amount: null, percent: null, confidence: null, source: '' },
  },
  warnings: [],
};

let fetchMock: ReturnType<typeof vi.fn>;

function itemNames() {
  return useReceiptStore.getState().receipts[0].items.map((item) => item.name);
}

async function scanUntilLimitReached() {
  const hook = renderHook(() => useReceiptImport({ activeReceiptId: 'r1' }));
  await act(() => hook.result.current.handleScanReceipt());
  await waitFor(() => expect(useGeminiStore.getState().showApiKeyModal).toBe(true));
  render(<GeminiApiKeyModal />);
}

function saveKey(key: string) {
  fireEvent.change(screen.getByLabelText('API key'), { target: { value: key } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
}

beforeEach(() => {
  window.localStorage.clear();
  resetAllStores();
  vi.stubEnv('VITE_API_URL', 'https://api.test');
  window.localStorage.setItem('split.deviceToken', 'pass');
  fetchMock = vi
    .fn()
    .mockResolvedValue(Response.json({ kind: 'over-limit', scope: 'device' }, { status: 429 }));
  vi.stubGlobal('fetch', fetchMock);
  directScan.mockReset().mockResolvedValue(receipt);
  seedStore([], [makeReceipt({ id: 'r1', items: [makeItem({ id: 'old', name: 'Old' })] })], {
    activeReceiptId: 'r1',
  });
  useReceiptStore
    .getState()
    .patchReceipt('r1', { receiptFile: new File(['img'], 'r.jpg', { type: 'image/jpeg' }) });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('key modal opened by a failed server scan', () => {
  it('retries that scan once with the saved key and fills the items', async () => {
    await scanUntilLimitReached();

    saveKey('AIza-new');

    await waitFor(() => expect(itemNames()).toEqual(['Nasi Lemak']));
    expect(directScan).toHaveBeenCalledTimes(1);
    expect(directScan.mock.calls[0][1]).toBe('AIza-new');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useGeminiStore.getState().showApiKeyModal).toBe(false);
  });

  it('does not retry again when the retry fails, and keeps the error', async () => {
    directScan.mockRejectedValue(new Error('API key not valid'));
    await scanUntilLimitReached();

    saveKey('AIza-bad');

    await waitFor(() =>
      expect(useScanStore.getState().scanStateByReceipt.r1.scanError).toBe('API key not valid'),
    );
    expect(directScan).toHaveBeenCalledTimes(1);
    expect(itemNames()).toEqual(['Old']);
  });

  it('retries nothing when the modal is closed without a key', async () => {
    await scanUntilLimitReached();

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(directScan).not.toHaveBeenCalled();
    expect(itemNames()).toEqual(['Old']);
    expect(useScanStore.getState().scanStateByReceipt.r1.scanError).toContain('free scans');
  });

  it('retries nothing when the key is saved empty', async () => {
    await scanUntilLimitReached();

    saveKey('   ');

    expect(directScan).not.toHaveBeenCalled();
  });

  it('retries nothing for a key saved from a modal opened by hand', () => {
    useGeminiStore.getState().setShowApiKeyModal(true);
    render(<GeminiApiKeyModal />);

    saveKey('AIza-manual');

    expect(directScan).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useGeminiStore.getState().geminiApiKeyInput).toBe('AIza-manual');
  });

  it('does not carry a closed scan retry into a later manual open', async () => {
    await scanUntilLimitReached();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    act(() => useGeminiStore.getState().setShowApiKeyModal(true));

    saveKey('AIza-later');

    expect(directScan).not.toHaveBeenCalled();
  });
});
