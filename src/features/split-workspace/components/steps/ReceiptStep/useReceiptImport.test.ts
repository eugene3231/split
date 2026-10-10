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
  beforeEach(resetAllStores);

  it('applies scan results when the receipt file is unchanged', async () => {
    const file = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
    seedReceiptWithFile(file);

    let resolveScan!: (payload: OcrResponse | null) => void;
    scanReceiptMock.mockImplementation(
      () => new Promise<OcrResponse | null>((resolve) => (resolveScan = resolve)),
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

  it('discards scan results when the receipt file was replaced mid-scan', async () => {
    const fileA = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
    seedReceiptWithFile(fileA);

    let resolveScan!: (payload: OcrResponse | null) => void;
    scanReceiptMock.mockImplementation(
      () => new Promise<OcrResponse | null>((resolve) => (resolveScan = resolve)),
    );

    const { result } = renderHook(() => useReceiptImport({ activeReceiptId: 'r1' }));

    let scanPromise: Promise<void> = Promise.resolve();
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
    expect(receipt?.items[0].name).toBe('Old item');
    expect(receipt?.receiptTotalInput).toBe('');
    expect(receipt?.serviceCharge.enabled).toBe(false);
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

  it('keeps existing receipt data when a new file is selected and then removed', () => {
    seedReceiptWithFile(new File(['old'], 'old.jpg', { type: 'image/jpeg' }));
    const before = useReceiptStore.getState().receipts[0];
    const { result } = renderHook(() => useReceiptImport({ activeReceiptId: 'r1' }));

    act(() => result.current.handleReceiptFileChange(new File(['new'], 'new.jpg')));
    expect(useReceiptStore.getState().receipts[0].items).toBe(before.items);
    expect(useReceiptStore.getState().receipts[0].discount).toBe(before.discount);
    expect(useReceiptStore.getState().receipts[0].serviceCharge).toBe(before.serviceCharge);
    expect(useReceiptStore.getState().receipts[0].gst).toBe(before.gst);
    act(() => result.current.handleReceiptFileChange(null));
    expect(useReceiptStore.getState().receipts[0].items[0].amountInput).toBe('5.00');
  });

  it.each([
    [
      'item amount',
      () =>
        useReceiptStore.getState().updateItem('i1', (item) => ({ ...item, amountInput: '15.00' })),
    ],
    [
      'discount',
      () =>
        useReceiptStore.getState().setDiscount({
          ...useReceiptStore.getState().receipts[0].discount,
          enabled: true,
          amountInput: '2.00',
          mode: 'amount',
        }),
    ],
    ['receipt total', () => useReceiptStore.getState().setReceiptTotalInput('15.00')],
    ['receipt name', () => useReceiptStore.getState().renameReceipt('r1', 'Corrected dinner')],
    ['currency', () => useReceiptStore.getState().setReceiptCurrency('r1', 'USD')],
    ['people', () => useReceiptStore.getState().addPeopleFromInput('Bob')],
    ['assignments', () => useReceiptStore.getState().normalizeItems()],
  ])('keeps %s edits made while scanning and exposes a retry', async (_name, edit) => {
    seedReceiptWithFile(new File(['a'], 'a.jpg', { type: 'image/jpeg' }));
    const deferred = Promise.withResolvers<OcrResponse | null>();
    scanReceiptMock.mockReturnValue(deferred.promise);
    const { result } = renderHook(() => useReceiptImport({ activeReceiptId: 'r1' }));
    let scanPromise: Promise<void> = Promise.resolve();
    act(() => {
      scanPromise = result.current.handleScanReceipt();
    });
    act(() => edit());
    const edited = useReceiptStore.getState().receipts[0];

    await act(async () => {
      deferred.resolve(makeOcrPayload());
      await scanPromise;
    });

    expect(useReceiptStore.getState().receipts[0]).toBe(edited);
    expect(useScanStore.getState().scanStateByReceipt.r1.scanError).toMatch(/scan again/i);
  });

  it('applies the result to its original receipt after adding another receipt and changing payer details', async () => {
    seedReceiptWithFile(new File(['a'], 'a.jpg', { type: 'image/jpeg' }));
    const deferred = Promise.withResolvers<OcrResponse | null>();
    scanReceiptMock.mockReturnValue(deferred.promise);
    const { result } = renderHook(() => useReceiptImport({ activeReceiptId: 'r1' }));
    let scanPromise: Promise<void> = Promise.resolve();
    act(() => {
      scanPromise = result.current.handleScanReceipt();
    });
    act(() => {
      useReceiptStore.getState().addReceipt();
      useReceiptStore.getState().setPayerMobile('91234567');
    });
    const newReceiptId = useReceiptStore.getState().activeReceiptId;

    await act(async () => {
      deferred.resolve(makeOcrPayload());
      await scanPromise;
    });

    expect(useReceiptStore.getState().receipts[0].items[0].name).toBe('Nasi Lemak');
    expect(useReceiptStore.getState().activeReceiptId).toBe(newReceiptId);
    expect(useReceiptStore.getState().payerMobile).toBe('91234567');
  });

  it('keeps the complete receipt and feedback when a scan finds no items', async () => {
    seedReceiptWithFile(new File(['a'], 'a.jpg', { type: 'image/jpeg' }));
    const before = useReceiptStore.getState().receipts[0];
    useScanStore.getState().setScanWarnings('r1', ['No confident line items']);
    scanReceiptMock.mockResolvedValue({ ...makeOcrPayload(), items: [] });
    const { result } = renderHook(() => useReceiptImport({ activeReceiptId: 'r1' }));

    await act(async () => result.current.handleScanReceipt());

    expect(useReceiptStore.getState().receipts[0]).toBe(before);
    expect(useScanStore.getState().scanStateByReceipt.r1.scanWarnings).toEqual([
      'No confident line items',
    ]);
    expect(useScanStore.getState().scanStateByReceipt.r1.scanError).toMatch(/no items/i);
  });

  it('replaces successful extraction from fresh defaults while retaining receipt settings', async () => {
    seedReceiptWithFile(new File(['a'], 'a.jpg', { type: 'image/jpeg' }));
    const state = useReceiptStore.getState();
    state.patchReceipt('r1', {
      name: 'Dinner in Bangkok',
      currency: 'THB',
      exchangeRateOverride: 0.04,
      receiptTotalInput: '99.00',
      discount: {
        ...state.receipts[0].discount,
        enabled: true,
        mode: 'amount',
        amountInput: '3.00',
      },
      serviceCharge: {
        ...state.receipts[0].serviceCharge,
        enabled: true,
        mode: 'amount',
        amountInput: '9.00',
      },
    });
    scanReceiptMock.mockResolvedValue({ ...makeOcrPayload(), total: null });
    const { result } = renderHook(() => useReceiptImport({ activeReceiptId: 'r1' }));

    await act(async () => result.current.handleScanReceipt());

    const receipt = useReceiptStore.getState().receipts[0];
    expect(receipt.items[0].name).toBe('Nasi Lemak');
    expect(receipt.discount.enabled).toBe(false);
    expect(receipt.discount.amountInput).toBe('');
    expect(receipt.serviceCharge.amountInput).toBe('');
    expect(receipt.serviceCharge.enabled).toBe(false);
    expect(receipt.receiptTotalInput).toBe('');
    expect(receipt.name).toBe('Dinner in Bangkok');
    expect(receipt.currency).toBe('THB');
    expect(receipt.exchangeRateOverride).toBe(0.04);
    expect(receipt.receiptFile?.name).toBe('a.jpg');
  });
});
