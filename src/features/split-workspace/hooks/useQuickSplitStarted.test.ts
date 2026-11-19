import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { quickSplitStore } from '@features/split-workspace/stores/receiptStore';
import { useQuickSplitStarted } from './useQuickSplitStarted';

beforeEach(() => quickSplitStore.getState().resetSplit());

describe('useQuickSplitStarted', () => {
  it('is false for a blank quick split and true once someone or an item is typed in', () => {
    const { result } = renderHook(() => useQuickSplitStarted());
    expect(result.current).toBe(false);

    const { receipts } = quickSplitStore.getState();
    act(() =>
      quickSplitStore
        .getState()
        .updateItem(receipts[0].id, receipts[0].items[0].id, (item) => ({ ...item, name: 'Tea' })),
    );
    expect(result.current).toBe(true);

    act(() => quickSplitStore.getState().resetSplit());
    act(() => quickSplitStore.getState().addPeople(['Alice']));
    expect(result.current).toBe(true);
  });
});
