import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { scanReceipt } from '@features/receipt-scanner';
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

vi.mock('@features/receipt-scanner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@features/receipt-scanner')>();
  return { ...actual, scanReceipt: vi.fn() };
});

const scanReceiptMock = vi.mocked(scanReceipt);

function makeOcrPayload(): OcrResponse {
  return {
    items: [{ description: 'Nasi Lemak', amount: 12.5 }],
    subtotal: 12.5,
    total: 12.5,
    detected: {
      gst: { enabled: false, amount: null, percent: null, confidence: null, source: 'none' },
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
  beforeEach(resetAllStores);

  it('applies scan results when the receipt file is unchanged', async () => {
    const file = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
    seedReceiptWithFile(file);

    let resolveScan!: (payload: OcrResponse | null) => void;
    scanReceiptMock.mockImplementation(
      () => new Promise<OcrResponse | null>((resolve) => (resolveScan = resolve)),
    );

    const { result } = renderHook(() => useReceiptImport({ activeReceiptId: 'r1' }));

    let scanPromise: Promise<OcrResponse | null> = Promise.resolve(null);
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
  });

  it('discards scan results when the receipt file was replaced mid-scan', async () => {
    const fileA = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
    seedReceiptWithFile(fileA);

    let resolveScan!: (payload: OcrResponse | null) => void;
    scanReceiptMock.mockImplementation(
      () => new Promise<OcrResponse | null>((resolve) => (resolveScan = resolve)),
    );

    const { result } = renderHook(() => useReceiptImport({ activeReceiptId: 'r1' }));

    let scanPromise: Promise<OcrResponse | null> = Promise.resolve(null);
    act(() => {
      scanPromise = result.current.handleScanReceipt();
    });

    const fileB = new File(['b'], 'b.jpg', { type: 'image/jpeg' });
    act(() => {
      result.current.handleReceiptFileChange(fileB);
      useScanStore.getState().setScanWarnings('r1', ['stale warning']);
    });

    await act(async () => {
      resolveScan(makeOcrPayload());
      await scanPromise;
    });

    const receipt = useReceiptStore.getState().receipts.find((r) => r.id === 'r1');
    expect(receipt?.items[0].name).toBe('');
    expect(receipt?.receiptTotalInput).toBe('');
    expect(useScanStore.getState().scanStateByReceipt['r1'].scanWarnings).toEqual([]);
  });

  it('discards scan results when the receipt file was removed mid-scan', async () => {
    const file = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
    seedReceiptWithFile(file);

    let resolveScan!: (payload: OcrResponse | null) => void;
    scanReceiptMock.mockImplementation(
      () => new Promise<OcrResponse | null>((resolve) => (resolveScan = resolve)),
    );

    const { result } = renderHook(() => useReceiptImport({ activeReceiptId: 'r1' }));

    let scanPromise: Promise<OcrResponse | null> = Promise.resolve(null);
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
  });
});
