import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReceiptSplit } from './useReceiptSplit';
import { useReceiptStore } from '../stores/receiptStore';
import {
  amountCharge,
  makeReceipt,
  resetAllStores,
  seedStore,
} from '../../../tests/integration/testHelpers';
import { computeSplit } from '@features/split-workspace/logic/split/split';
import { makeItem, percentCharge } from '../../../tests/integration/testHelpers';
import { useReconciliation } from './useReconciliation';
import type { ChargeState, SplitResult } from '@shared/types';
import { defaultTipState } from '@features/split-workspace/constants';

const disabledCharge: ChargeState = {
  enabled: false,
  mode: 'percent',
  amountInput: '',
  percentInput: '',
  detectedConfidence: null,
  detectedSource: null,
};

const makeSplit = (grandTotalCents: number): SplitResult => ({
  lineItemsByPerson: {},
  subtotalByPersonCents: {},
  discountByPersonCents: {},
  serviceByPersonCents: {},
  gstByPersonCents: {},
  tipByPersonCents: {},
  totalByPersonCents: {},
  subtotalCents: grandTotalCents,
  discountCents: 0,
  serviceChargeCents: 0,
  gstCents: 0,
  tipCents: 0,
  grandTotalCents,
  unassignedItemCount: 0,
  involvedCountByPerson: {},
});

describe('useReconciliation', () => {
  it('corrects the pretax discount and recomputes both percentage charges', () => {
    const setDiscount = vi.fn();
    const split = computeSplit({
      people: [{ id: 'a', name: 'A' }],
      items: [
        makeItem({
          amountInput: '100.00',
          assignment: { mode: 'single', personId: 'a', personIds: ['a'] },
        }),
      ],
      discount: disabledCharge,
      serviceCharge: percentCharge('10'),
      gst: percentCharge('9'),
      tip: defaultTipState,
    });
    const { result } = renderHook(() =>
      useReconciliation({
        split,
        discount: disabledCharge,
        serviceCharge: percentCharge('10'),
        gst: percentCharge('9'),
        setDiscount,
        receiptTotalInput: '107.91',
      }),
    );
    act(() => result.current.handleApplyReconciliationDiscount());
    expect(setDiscount).toHaveBeenCalledWith({
      ...disabledCharge,
      enabled: true,
      mode: 'amount',
      amountInput: '10.00',
    });
  });

  it('does not call setDiscount when reconciliationCents is zero', () => {
    const setDiscount = vi.fn();
    const { result } = renderHook(() =>
      useReconciliation({
        split: makeSplit(1000),
        discount: disabledCharge,
        serviceCharge: disabledCharge,
        gst: disabledCharge,
        setDiscount,
        receiptTotalInput: '10.00',
      }),
    );

    act(() => {
      result.current.handleApplyReconciliationDiscount();
    });

    expect(setDiscount).not.toHaveBeenCalled();
  });

  it('does not call setDiscount when reconciliationCents is positive', () => {
    const setDiscount = vi.fn();
    const { result } = renderHook(() =>
      useReconciliation({
        split: makeSplit(1000),
        discount: disabledCharge,
        serviceCharge: disabledCharge,
        gst: disabledCharge,
        setDiscount,
        receiptTotalInput: '12.00',
      }),
    );

    act(() => {
      result.current.handleApplyReconciliationDiscount();
    });

    expect(setDiscount).not.toHaveBeenCalled();
  });

  it('calls setDiscount when reconciliationCents is negative', () => {
    const setDiscount = vi.fn();
    const { result } = renderHook(() =>
      useReconciliation({
        split: makeSplit(1000),
        discount: disabledCharge,
        serviceCharge: disabledCharge,
        gst: disabledCharge,
        setDiscount,
        receiptTotalInput: '9.00',
      }),
    );

    act(() => {
      result.current.handleApplyReconciliationDiscount();
    });

    expect(setDiscount).toHaveBeenCalled();
  });
});

describe('receipt correction state flow', () => {
  it('recomputes the editor receipt after a tax-aware correction', () => {
    resetAllStores();
    const person = { id: 'a', name: 'A' };
    const receipt = makeReceipt({
      items: [
        makeItem({
          amountInput: '100.00',
          assignment: { mode: 'single', personId: 'a', personIds: ['a'] },
        }),
      ],
      discount: percentCharge('5'),
      serviceCharge: percentCharge('10'),
      gst: percentCharge('9'),
      receiptTotalInput: '107.91',
    });
    seedStore([person], [receipt]);
    const { result } = renderHook(() => useReceiptSplit());
    act(() => result.current.reconciliation.applyCorrectiveDiscount());
    expect(useReceiptStore.getState().receipts[0].discount).toMatchObject({
      mode: 'amount',
      amountInput: '10.00',
    });
    expect(result.current.active.split.grandTotalCents).toBe(10791);
    expect(result.current.reconciliation.cents).toBe(0);
  });

  it('keeps an unavoidable fixed-charge residual visible and repeated correction stable', () => {
    resetAllStores();
    const person = { id: 'a', name: 'A' };
    const receipt = makeReceipt({
      items: [
        makeItem({
          amountInput: '1.00',
          assignment: { mode: 'single', personId: 'a', personIds: ['a'] },
        }),
      ],
      serviceCharge: amountCharge('0.50'),
      receiptTotalInput: '0.10',
    });
    seedStore([person], [receipt]);
    const { result } = renderHook(() => useReceiptSplit());
    act(() => result.current.reconciliation.applyCorrectiveDiscount());
    expect(result.current.active.split.grandTotalCents).toBe(50);
    expect(result.current.reconciliation.cents).toBe(-40);
    const after = useReceiptStore.getState().receipts;
    act(() => result.current.reconciliation.applyCorrectiveDiscount());
    expect(useReceiptStore.getState().receipts).toBe(after);
    expect(result.current.reconciliation.cents).toBe(-40);
  });
});

describe('useReconciliation with a tip', () => {
  it('compares the printed total with the bill before the tip', () => {
    const split = { ...makeSplit(11500), tipCents: 1500 };
    const { result } = renderHook(() =>
      useReconciliation({
        split,
        discount: disabledCharge,
        serviceCharge: disabledCharge,
        gst: disabledCharge,
        setDiscount: vi.fn(),
        receiptTotalInput: '100.00',
      }),
    );

    expect(result.current.reconciliationCents).toBe(0);
  });
});
