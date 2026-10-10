import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeReceiptWithGemini } from '@features/receipt-scanner/api/geminiApi';
import { useGeminiStore } from '@features/split-workspace/stores/geminiStore';
import { useScanStore } from '@features/receipt-scanner/stores/scanStore';
import type { OcrResponse } from '@shared/types';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import {
  makeItem,
  makePerson,
  makeReceipt,
  resetAllStores,
  seedStore,
} from '../../../../../tests/integration/testHelpers';
import { useReceiptImport } from './useReceiptImport';

vi.mock('@features/receipt-scanner/api/geminiApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@features/receipt-scanner/api/geminiApi')>();
  return { ...actual, analyzeReceiptWithGemini: vi.fn() };
});

const scanReceiptMock = vi.mocked(analyzeReceiptWithGemini);

function makeOcrPayload(): OcrResponse {
  return {
    items: [{ description: 'Nasi Lemak', amount: 12.5 }],
    subtotal: 12.5,
    total: 12.5,
    detected: {
      gst: { enabled: true, amount: null, percent: 9, confidence: 1, source: 'gemini' },
      serviceCharge: {
        enabled: false,
        amount: null,
        percent: null,
        confidence: null,
        source: 'none',
      },
    },
    warnings: [],
  };
}

function seedReceiptWithFile(file: File) {
  const alice = makePerson('Alice');
  const receipt = makeReceipt({
    id: 'r1',
    items: [
      makeItem({
        id: 'i1',
        name: 'Old item',
        amountInput: '5.00',
        assignment: { mode: 'equal', personId: '', personIds: [alice.id] },
      }),
    ],
  });
  seedStore([alice], [receipt], { activeReceiptId: 'r1' });
  useReceiptStore.setState((state) => ({
    receipts: state.receipts.map((r) => (r.id === 'r1' ? { ...r, receiptFile: file } : r)),
  }));
}

describe('useReceiptImport', () => {
  beforeEach(() => {
    resetAllStores();
    scanReceiptMock.mockReset();
    useGeminiStore.setState({ geminiApiKeyInput: 'test-key' });
  });

  it('applies scan results when the receipt file is unchanged', async () => {
    const file = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
    seedReceiptWithFile(file);

    let resolveScan!: (payload: OcrResponse) => void;
    scanReceiptMock.mockImplementation(
      () => new Promise<OcrResponse>((resolve) => (resolveScan = resolve)),
    );

    const { result } = renderHook(() => useReceiptImport({ activeReceiptId: 'r1' }));

    let scanPromise: Promise<void> = Promise.resolve();
    act(() => {
      scanPromise = result.current.handleScanReceipt();
    });
    await act(async () => {
      resolveScan(makeOcrPayload());
      await scanPromise;
    });

    const receipt = useReceiptStore.getState().receipts.find((r) => r.id === 'r1');
    expect(receipt?.items[0].name).toBe('Nasi Lemak');
    expect(receipt?.receiptTotalInput).toBe('12.50');
    expect(receipt?.gst.enabled).toBe(true);
    expect(receipt?.gst.percentInput).toBe('9');
  });

  it('keeps a loaded mock receipt when an older scan finishes', async () => {
    const file = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
    seedReceiptWithFile(file);

    let resolveScan!: (payload: OcrResponse) => void;
    scanReceiptMock.mockImplementation(
      () => new Promise<OcrResponse>((resolve) => (resolveScan = resolve)),
    );

    const { result } = renderHook(() => useReceiptImport({ activeReceiptId: 'r1' }));
    let scanPromise: Promise<void> = Promise.resolve();
    act(() => {
      scanPromise = result.current.handleScanReceipt();
      result.current.mockReceipts[0].onLoad();
    });

    expect(useReceiptStore.getState().receipts[0].items[0].name).toBe('Chicken Rice');

    await act(async () => {
      resolveScan(makeOcrPayload());
      await scanPromise;
    });

    const receipt = useReceiptStore.getState().receipts[0];
    expect(receipt.items.map((item) => item.name)).toEqual([
      'Chicken Rice',
      'Iced Lemon Tea',
      'Pasta Alfredo',
      'Truffle Fries',
    ]);
    expect(receipt.receiptTotalInput).toBe('47.48');
    expect(receipt.receiptFile).toBeNull();
  });

  it.each(['success', 'failure'] as const)(
    'preserves replacement feedback when an older scan reports %s',
    async (outcome) => {
      seedReceiptWithFile(new File(['a'], 'a.jpg', { type: 'image/jpeg' }));
      let resolveScan!: (payload: OcrResponse) => void;
      let rejectScan!: (error: Error) => void;
      scanReceiptMock.mockImplementation(
        () =>
          new Promise<OcrResponse>((resolve, reject) => {
            resolveScan = resolve;
            rejectScan = reject;
          }),
      );
      const { result } = renderHook(() => useReceiptImport({ activeReceiptId: 'r1' }));
      let scanPromise = Promise.resolve();
      act(() => {
        scanPromise = result.current.handleScanReceipt();
        result.current.mockReceipts[0].onLoad();
        useScanStore.getState().setScanWarnings('r1', ['Check the replacement receipt']);
      });
      await act(async () => {
        if (outcome === 'success') {
          resolveScan({ ...makeOcrPayload(), warnings: ['Older scan warning'] });
        } else {
          rejectScan(new Error('Older scan failed'));
        }
        await scanPromise;
      });
      const feedback = useScanStore.getState().scanStateByReceipt.r1;
      expect(feedback.scanWarnings).toEqual(['Check the replacement receipt']);
      expect(feedback.scanError).toBeNull();
      expect(feedback.isScanning).toBe(false);
      expect(useReceiptStore.getState().receipts[0].items[0].name).toBe('Chicken Rice');
    },
  );

  it('ignores late status updates after the receipt file changes', async () => {
    seedReceiptWithFile(new File(['a'], 'a.jpg', { type: 'image/jpeg' }));
    let resolveScan!: (payload: OcrResponse) => void;
    let reportStatus!: (status: string) => void;
    scanReceiptMock.mockImplementation((_file, _key, _model, setStatus) => {
      reportStatus = setStatus!;
      return new Promise<OcrResponse>((resolve) => {
        resolveScan = resolve;
      });
    });
    const { result } = renderHook(() => useReceiptImport({ activeReceiptId: 'r1' }));
    let scanPromise = Promise.resolve();
    act(() => {
      scanPromise = result.current.handleScanReceipt();
      result.current.handleReceiptFileChange(new File(['b'], 'b.jpg', { type: 'image/jpeg' }));
      reportStatus('Older request completed');
    });
    expect(useScanStore.getState().scanStateByReceipt.r1.scanStatus).toBe('');
    await act(async () => {
      resolveScan(makeOcrPayload());
      await scanPromise;
    });
  });

  it('discards scan results when the receipt file was replaced mid-scan', async () => {
    const fileA = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
    seedReceiptWithFile(fileA);

    let resolveScan!: (payload: OcrResponse) => void;
    scanReceiptMock.mockImplementation(
      () => new Promise<OcrResponse>((resolve) => (resolveScan = resolve)),
    );

    const { result } = renderHook(() => useReceiptImport({ activeReceiptId: 'r1' }));

    let scanPromise: Promise<void> = Promise.resolve();
    act(() => {
      scanPromise = result.current.handleScanReceipt();
    });

    const fileB = new File(['b'], 'b.jpg', { type: 'image/jpeg' });
    act(() => {
      result.current.handleReceiptFileChange(fileB);
    });

    await act(async () => {
      resolveScan(makeOcrPayload());
      await scanPromise;
    });

    const receipt = useReceiptStore.getState().receipts.find((r) => r.id === 'r1');
    expect(receipt?.items[0].name).toBe('');
    expect(receipt?.receiptTotalInput).toBe('');
    // A stale patch would have applied the payload's disabled serviceCharge
    // detection; the file-change reset leaves the default (enabled, 10%).
    expect(receipt?.serviceCharge.enabled).toBe(true);
    expect(receipt?.serviceCharge.percentInput).toBe('10');
    expect(useScanStore.getState().scanStateByReceipt['r1'].scanWarnings).toEqual([]);
  });

  it('discards scan results when the receipt file was removed mid-scan', async () => {
    const file = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
    seedReceiptWithFile(file);

    let resolveScan!: (payload: OcrResponse) => void;
    scanReceiptMock.mockImplementation(
      () => new Promise<OcrResponse>((resolve) => (resolveScan = resolve)),
    );

    const { result } = renderHook(() => useReceiptImport({ activeReceiptId: 'r1' }));

    let scanPromise: Promise<void> = Promise.resolve();
    act(() => {
      scanPromise = result.current.handleScanReceipt();
    });

    act(() => {
      result.current.handleReceiptFileChange(null);
    });

    await act(async () => {
      resolveScan(makeOcrPayload());
      await scanPromise;
    });

    const receipt = useReceiptStore.getState().receipts.find((r) => r.id === 'r1');
    expect(receipt?.items[0].name).toBe('Old item');
    expect(receipt?.receiptTotalInput).toBe('');
    expect(receipt?.gst.enabled).toBe(false);
  });
});
