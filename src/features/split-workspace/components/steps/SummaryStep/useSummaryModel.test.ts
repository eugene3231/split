import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSummaryModel } from './useSummaryModel';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import {
  percentCharge,
  makeItem,
  makePerson,
  makeReceipt,
  resetAllStores,
  seedStore,
} from '../../../../../tests/integration/testHelpers';
import { equalShares } from '@features/split-workspace/logic/assignment';
import type { Reconciliation } from '@features/split-workspace/logic/reconciliation';
import { soleReceipt } from '@features/split-workspace/logic/summaryView';

const { generatePaynowQrDataUrls } = vi.hoisted(() => ({
  generatePaynowQrDataUrls: vi.fn(),
}));

vi.mock('@features/payments', async (importActual) => ({
  ...(await importActual<typeof import('@features/payments')>()),
  generatePaynowQrDataUrls,
}));

beforeEach(() => {
  resetAllStores();
  generatePaynowQrDataUrls.mockReset().mockResolvedValue({});
});

/** What the summary's fix button does: write the fix to the receipt on the open tab. */
function applyFix(receiptId: string, { fix }: Reconciliation) {
  if (!fix) throw new Error('There is no fix to apply');
  useReceiptStore.getState().patchReceipt(receiptId, fix);
}

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
          assignment: equalShares([alice.id]),
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
          assignment: equalShares([bob.id]),
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
    expect(result.current.view.scope).toBe('one');
    expect(soleReceipt(result.current.view)).toBe(receipt2);
  });

  it('reconciles and corrects the selected receipt in its native currency', () => {
    const alice = makePerson('Alice');
    const assignment = equalShares([alice.id]);
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
    act(() => applyFix('r2', result.current.reconciliation));

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

  it('uses selected receipt taxes for correction while another receipt is active', () => {
    const alice = makePerson('Alice');
    const assignment = equalShares([alice.id]);
    const editor = makeReceipt({
      id: 'editor',
      items: [makeItem({ amountInput: '20.00', assignment })],
    });
    const selected = makeReceipt({
      id: 'selected',
      currency: 'USD',
      items: [makeItem({ amountInput: '100.00', assignment })],
      discount: percentCharge('5'),
      serviceCharge: percentCharge('10'),
      gst: percentCharge('9'),
      receiptTotalInput: '107.91',
    });
    seedStore([alice], [editor, selected], {
      activeReceiptId: 'editor',
      exchangeRates: { SGD: 1, USD: 1.35 },
    });
    const { result } = renderHook(() =>
      useSummaryModel({ activeTab: 'selected', showBaseCurrency: true }),
    );
    act(() => applyFix('selected', result.current.reconciliation));
    expect(useReceiptStore.getState().receipts[0]).toEqual(editor);
    expect(useReceiptStore.getState().receipts[1].discount).toMatchObject({
      mode: 'amount',
      amountInput: '10.00',
    });
    expect(result.current.reconciliation).toEqual({ cents: 0, fix: null });
  });

  it('has no receipt reconciliation on the Total tab', () => {
    const alice = makePerson('Alice');
    const receipt = makeReceipt({
      id: 'r1',
      items: [
        makeItem({
          amountInput: '10.00',
          assignment: equalShares([alice.id]),
        }),
      ],
      receiptTotalInput: '8.00',
    });
    seedStore([alice], [receipt], { activeReceiptId: 'r1' });

    const { result } = renderHook(() =>
      useSummaryModel({ activeTab: 'total', showBaseCurrency: false }),
    );

    expect(result.current.reconciliation).toEqual({ cents: null, fix: null });
  });

  it('hides old QR URLs while receipt amounts or payer mobile change', async () => {
    const alice = makePerson('Alice');
    const assignment = equalShares([alice.id]);
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
    expect(result.current.payNowStatus).toBe('ready');

    rerender({ activeTab: 'r2' });
    expect(result.current.summaryBreakdown.personBreakdowns[0].qrDataUrl).toBeUndefined();
    expect(result.current.payNowStatus).toBe('generating');
    await act(async () => second.resolve({ [alice.id]: 'data:r2' }));
    expect(result.current.summaryBreakdown.personBreakdowns[0].qrDataUrl).toBe('data:r2');

    act(() => useReceiptStore.getState().setPayerMobile('98765432'));
    expect(result.current.summaryBreakdown.personBreakdowns[0].qrDataUrl).toBeUndefined();
    expect(result.current.payNowStatus).toBe('generating');
    await act(async () => third.resolve({ [alice.id]: 'data:new-mobile' }));
    expect(result.current.summaryBreakdown.personBreakdowns[0].qrDataUrl).toBe('data:new-mobile');
  });
  it('does not claim success when a person owing money has no generated QR', async () => {
    const alice = makePerson('Alice');
    const bob = makePerson('Bob');
    seedStore(
      [alice, bob],
      [
        makeReceipt({
          items: [
            makeItem({
              amountInput: '10',
              assignment: equalShares([alice.id, bob.id]),
            }),
          ],
        }),
      ],
    );
    useReceiptStore.getState().setPayerMobile('91234567');
    generatePaynowQrDataUrls.mockResolvedValue({ [alice.id]: 'data:alice', [bob.id]: '' });
    const { result } = renderHook(() =>
      useSummaryModel({ activeTab: 'total', showBaseCurrency: false }),
    );
    await act(async () => {});
    expect(result.current.payNowStatus).toBe('failed');
  });

  it('reports generation failure when QR generation rejects', async () => {
    const alice = makePerson('Alice');
    seedStore(
      [alice],
      [
        makeReceipt({
          items: [
            makeItem({
              amountInput: '10',
              assignment: equalShares([alice.id]),
            }),
          ],
        }),
      ],
    );
    useReceiptStore.getState().setPayerMobile('91234567');
    generatePaynowQrDataUrls.mockRejectedValue(new Error('Canvas failed'));
    const { result } = renderHook(() =>
      useSummaryModel({ activeTab: 'total', showBaseCurrency: false }),
    );
    await act(async () => {});
    expect(result.current.payNowStatus).toBe('failed');
  });
});
