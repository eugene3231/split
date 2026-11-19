import { useStore } from 'zustand';
import { quickSplitStore } from '@features/split-workspace/stores/receiptStore';

/** Whether the quick split holds anything worth going back to: a person, or an item typed in. */
export function useQuickSplitStarted(): boolean {
  return useStore(
    quickSplitStore,
    (state) =>
      state.people.length > 0 ||
      state.receipts.some((receipt) =>
        receipt.items.some((item) => item.name.trim() !== '' || item.amountInput.trim() !== ''),
      ),
  );
}
