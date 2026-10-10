import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSummaryModel } from './useSummaryModel';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import {
  makeItem,
  makePerson,
  makeReceipt,
  resetAllStores,
  seedStore,
} from '../../../../../tests/integration/testHelpers';

const { generatePaynowQrDataUrls } = vi.hoisted(() => ({
  generatePaynowQrDataUrls: vi.fn(),
}));

vi.mock('@features/payments', () => ({ generatePaynowQrDataUrls }));

beforeEach(() => {
  resetAllStores();
  generatePaynowQrDataUrls.mockReset().mockResolvedValue({});
});

function deferredQrUrls() {
  let resolve!: (urls: Record<string, string>) => void;
  const promise = new Promise<Record<string, string>>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe('useSummaryModel', () => {
  it('uses activeTab as the summary receipt source when it differs from activeReceiptId', () => {
    const alice = makePerson('Alice');
    const bob = makePerson('Bob');
    const receipt1 = makeReceipt({
      id: 'r1',
      name: 'Receipt 1',
      items: [
        makeItem({
          amountInput: '10.00',
          assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
        }),
      ],
      discount: {
        enabled: true,
        mode: 'percent',
        amountInput: '',
        percentInput: '5',
        detectedConfidence: null,
        detectedSource: null,
      },
    });
    const receipt2 = makeReceipt({
      id: 'r2',
      name: 'Receipt 2',
      items: [
        makeItem({
          amountInput: '20.00',
          assignment: { mode: 'single', personId: bob.id, personIds: [bob.id] },
        }),
      ],
      discount: {
        enabled: true,
        mode: 'amount',
        amountInput: '1.00',
        percentInput: '',
        detectedConfidence: null,
        detectedSource: null,
      },
    });

    seedStore([alice, bob], [receipt1, receipt2], { activeReceiptId: 'r1' });

    const { result } = renderHook(() =>
      useSummaryModel({
        activeTab: 'r2',
        showBaseCurrency: false,
      }),
    );

    expect(useReceiptStore.getState().activeReceiptId).toBe('r1');
    expect(result.current.activeSummaryReceipt?.id).toBe('r2');
    expect(result.current.view.kind).toBe('receipt');
    if (result.current.view.kind !== 'receipt') return;
    expect(result.current.view.receipt?.id).toBe('r2');
    expect(result.current.view.discount).toBe(receipt2.discount);
  });

  it('reconciles and corrects the selected receipt in its native currency', () => {
    const alice = makePerson('Alice');
    const assignment = { mode: 'single' as const, personId: alice.id, personIds: [alice.id] };
    const receipt1 = makeReceipt({
      id: 'r1',
      items: [makeItem({ amountInput: '10.00', assignment })],
      receiptTotalInput: '8.00',
    });
    const receipt2 = makeReceipt({
      id: 'r2',
      currency: 'USD',
      items: [makeItem({ amountInput: '20.00', assignment })],
      receiptTotalInput: '19.00',
    });
    seedStore([alice], [receipt1, receipt2], {
      activeReceiptId: 'r1',
      exchangeRates: { SGD: 1, USD: 1.35 },
    });

    const { result } = renderHook(() =>
      useSummaryModel({ activeTab: 'r2', showBaseCurrency: true }),
    );

    expect(result.current.reconciliation.cents).toBe(-100);
    act(() => result.current.reconciliation.applyCorrectiveDiscount());

    const state = useReceiptStore.getState();
    expect(state.activeReceiptId).toBe('r1');
    expect(state.receipts[0].discount).toEqual(receipt1.discount);
    expect(state.receipts[1].discount).toMatchObject({
      enabled: true,
      mode: 'amount',
      amountInput: '1.00',
    });
    expect(result.current.reconciliation.cents).toBe(0);
  });

  it('has no receipt reconciliation on the Total tab', () => {
    const alice = makePerson('Alice');
    const receipt = makeReceipt({
      id: 'r1',
      items: [
        makeItem({
          amountInput: '10.00',
          assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
        }),
      ],
      receiptTotalInput: '8.00',
    });
    seedStore([alice], [receipt], { activeReceiptId: 'r1' });

    const { result } = renderHook(() =>
      useSummaryModel({ activeTab: 'total', showBaseCurrency: false }),
    );

    expect(result.current.reconciliation.cents).toBeNull();
    act(() => result.current.reconciliation.applyCorrectiveDiscount());
    expect(useReceiptStore.getState().receipts[0].discount).toEqual(receipt.discount);
  });

  it('hides old QR URLs while receipt amounts or payer mobile change', async () => {
    const alice = makePerson('Alice');
    const assignment = { mode: 'single' as const, personId: alice.id, personIds: [alice.id] };
    const receipt1 = makeReceipt({
      id: 'r1',
      items: [makeItem({ amountInput: '10.00', assignment })],
    });
    const receipt2 = makeReceipt({
      id: 'r2',
      items: [makeItem({ amountInput: '20.00', assignment })],
    });
    seedStore([alice], [receipt1, receipt2]);
    useReceiptStore.getState().setPayerMobile('91234567');
    const first = deferredQrUrls();
    const second = deferredQrUrls();
    const third = deferredQrUrls();
    generatePaynowQrDataUrls
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
      .mockReturnValueOnce(third.promise);

    const { result, rerender } = renderHook(
      ({ activeTab }) => useSummaryModel({ activeTab, showBaseCurrency: false }),
      { initialProps: { activeTab: 'r1' } },
    );
    await act(async () => first.resolve({ [alice.id]: 'data:r1' }));
    expect(result.current.summaryBreakdown.personBreakdowns[0].qrDataUrl).toBe('data:r1');

    rerender({ activeTab: 'r2' });
    expect(result.current.summaryBreakdown.personBreakdowns[0].qrDataUrl).toBeUndefined();
    await act(async () => second.resolve({ [alice.id]: 'data:r2' }));
    expect(result.current.summaryBreakdown.personBreakdowns[0].qrDataUrl).toBe('data:r2');

    act(() => useReceiptStore.getState().setPayerMobile('98765432'));
    expect(result.current.summaryBreakdown.personBreakdowns[0].qrDataUrl).toBeUndefined();
    await act(async () => third.resolve({ [alice.id]: 'data:new-mobile' }));
    expect(result.current.summaryBreakdown.personBreakdowns[0].qrDataUrl).toBe('data:new-mobile');
  });
});
