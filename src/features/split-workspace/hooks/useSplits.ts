import { deriveSplits, type Splits } from '@features/split-workspace/logic/split/deriveSplits';
import { useCurrencyStore } from '@features/split-workspace/stores/currencyStore';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';

/** The workspace's splits, computed once for every component that reads them. */
export function useSplits(): Splits {
  return deriveSplits(
    useReceiptStore((state) => state.people),
    useReceiptStore((state) => state.receipts),
    useCurrencyStore((state) => state.exchangeRates),
  );
}
