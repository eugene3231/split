import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReconciliation } from './useReconciliation';
import type { ChargeState, SplitResult } from '@shared/types';

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
  totalByPersonCents: {},
  subtotalCents: grandTotalCents,
  discountCents: 0,
  serviceChargeCents: 0,
  gstCents: 0,
  grandTotalCents,
  unassignedItemCount: 0,
  involvedCountByPerson: {},
});

describe('useReconciliation', () => {
  it('does not call setDiscount when reconciliationCents is zero', () => {
    const setDiscount = vi.fn();
    const { result } = renderHook(() =>
      useReconciliation(makeSplit(1000), disabledCharge, setDiscount, '10.00'),
    );

    act(() => {
      result.current.handleApplyReconciliationDiscount();
    });

    expect(setDiscount).not.toHaveBeenCalled();
  });

  it('does not call setDiscount when reconciliationCents is positive', () => {
    const setDiscount = vi.fn();
    const { result } = renderHook(() =>
      useReconciliation(makeSplit(1000), disabledCharge, setDiscount, '12.00'),
    );

    act(() => {
      result.current.handleApplyReconciliationDiscount();
    });

    expect(setDiscount).not.toHaveBeenCalled();
  });

  it('calls setDiscount when reconciliationCents is negative', () => {
    const setDiscount = vi.fn();
    const { result } = renderHook(() =>
      useReconciliation(makeSplit(1000), disabledCharge, setDiscount, '9.00'),
    );

    act(() => {
      result.current.handleApplyReconciliationDiscount();
    });

    expect(setDiscount).toHaveBeenCalled();
  });
});
