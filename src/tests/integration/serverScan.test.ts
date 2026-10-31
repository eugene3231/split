import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OcrResponse } from '@shared/types';
import { useScanStore } from '@features/receipt-scanner/stores/scanStore';
import { useTurnstileStore } from '@features/receipt-scanner/stores/turnstileStore';
import { useGeminiStore } from '@features/split-workspace/stores/geminiStore';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { useReceiptImport } from '@features/split-workspace/components/steps/ReceiptStep/useReceiptImport';
import { equalShares } from '@features/split-workspace/logic/assignment';
import { makeItem, makePerson, makeReceipt, resetAllStores, seedStore } from './testHelpers';

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
let stopTurnstile: () => void;

function seedReceiptWithFile() {
  const alice = makePerson('Alice');
  seedStore(
    [alice],
    [
      makeReceipt({
        id: 'r1',
        items: [
          makeItem({
            id: 'old',
            name: 'Old',
            amountInput: '5.00',
            assignment: equalShares([alice.id]),
          }),
        ],
      }),
    ],
    { activeReceiptId: 'r1' },
  );
  useReceiptStore
    .getState()
    .patchReceipt('r1', { receiptFile: new File(['img'], 'r.jpg', { type: 'image/jpeg' }) });
}

beforeEach(() => {
  window.localStorage.clear();
  resetAllStores();
  vi.stubEnv('VITE_API_URL', 'https://api.test');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  stopTurnstile = useTurnstileStore.subscribe((state) => state.pending?.resolve('turnstile-ok'));
  seedReceiptWithFile();
});

afterEach(() => {
  stopTurnstile();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('receipt step scanning through the server', () => {
  it('fills the items with no key, minting a pass on the first scan', async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ token: 'pass' }))
      .mockResolvedValueOnce(Response.json({ receipt }));
    const { result } = renderHook(() => useReceiptImport({ activeReceiptId: 'r1' }));

    await act(() => result.current.handleScanReceipt());

    const items = useReceiptStore.getState().receipts[0].items;
    expect(items.map((item) => item.name)).toEqual(['Nasi Lemak']);
    expect(useGeminiStore.getState().showApiKeyModal).toBe(false);
  });

  it('opens the key modal with the limit reason when the server says over-limit', async () => {
    window.localStorage.setItem('split.deviceToken', 'pass');
    fetchMock.mockResolvedValueOnce(
      Response.json({ kind: 'over-limit', scope: 'device' }, { status: 429 }),
    );
    const { result } = renderHook(() => useReceiptImport({ activeReceiptId: 'r1' }));

    await act(() => result.current.handleScanReceipt());

    await waitFor(() => expect(useGeminiStore.getState().showApiKeyModal).toBe(true));
    expect(useGeminiStore.getState().apiKeyModalReason).toBe(
      "You've used today's free scans. Add your own Gemini key to keep scanning.",
    );
    expect(useReceiptStore.getState().receipts[0].items.map((item) => item.name)).toEqual(['Old']);
    expect(useScanStore.getState().scanStateByReceipt.r1.isScanning).toBe(false);
  });

  it('does not open the key modal for a bad photo', async () => {
    window.localStorage.setItem('split.deviceToken', 'pass');
    fetchMock.mockResolvedValueOnce(Response.json({ kind: 'bad-image' }, { status: 413 }));
    const { result } = renderHook(() => useReceiptImport({ activeReceiptId: 'r1' }));

    await act(() => result.current.handleScanReceipt());

    expect(useGeminiStore.getState().showApiKeyModal).toBe(false);
    expect(useScanStore.getState().scanStateByReceipt.r1.scanError).toContain("can't be scanned");
  });
});
