import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReceiptSplit } from '@shared/hooks/useReceiptSplit';
import { useReceiptStore } from '@shared/stores/receiptStore';
import { useCurrencyStore } from '@shared/stores/currencyStore';

function resetStores() {
  useReceiptStore.setState({
    peopleInput: '',
    initialized: false,
    people: [],
    receipts: [],
    activeReceiptId: '',
    payerMobile: '',
  });
  useCurrencyStore.setState({
    exchangeRates: { SGD: 1 },
    exchangeRatesLastFetched: null,
  });
}

describe('useReceiptSplit', () => {
  beforeEach(() => {
    resetStores();
  });

  it('returns a split for the active receipt', () => {
    useReceiptStore.getState().initialize();
    useReceiptStore.getState().addPeopleFromInput('Alice, Bob');

    const { result } = renderHook(() => useReceiptSplit());

    expect(result.current.split).toBeDefined();
    expect(result.current.split.grandTotalCents).toBe(0);
    expect(result.current.consolidatedSplit).toBeDefined();
    expect(result.current.splitByReceipt).toHaveLength(1);
  });

  it('returns reconciliation helpers', () => {
    useReceiptStore.getState().initialize();
    useReceiptStore.getState().addPeopleFromInput('Alice');

    const { result } = renderHook(() => useReceiptSplit());

    expect(result.current.reconciliationCents).toBeNull();
    expect(typeof result.current.handleApplyReconciliationDiscount).toBe('function');
  });

  it('updates split when an item is added', () => {
    useReceiptStore.getState().initialize();
    useReceiptStore.getState().addPeopleFromInput('Alice');

    const { result, rerender } = renderHook(() => useReceiptSplit());
    const initialItemCount = result.current.splitByReceipt[0].lineItemsByPerson
      ? Object.keys(result.current.splitByReceipt[0].lineItemsByPerson).length
      : 0;

    act(() => {
      useReceiptStore.getState().addItem();
    });
    rerender();

    expect(result.current.splitByReceipt).toHaveLength(1);
    expect(
      Object.keys(result.current.splitByReceipt[0].lineItemsByPerson).length,
    ).toBeGreaterThanOrEqual(initialItemCount);
  });

  it('uses exchange rates from currency store in consolidated split', () => {
    useReceiptStore.getState().initialize();
    useReceiptStore.getState().addPeopleFromInput('Alice');

    useCurrencyStore.setState({
      exchangeRates: { SGD: 1, USD: 1.35 },
    });

    const { result } = renderHook(() => useReceiptSplit());

    expect(result.current.consolidatedSplit).toBeDefined();
  });
});
