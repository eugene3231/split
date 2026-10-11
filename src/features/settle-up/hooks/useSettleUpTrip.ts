import { useLayoutEffect, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { useCurrencyStore } from '@features/split-workspace/stores/currencyStore';
import { BASE_CURRENCY } from '@shared/constants';
import { convertSplitResult } from '@shared/logic/core/exchangeRates';
import { computeSplit } from '@shared/logic/split/split';
import { getReceiptTotalCents, type SettleUpReceipt } from '../logic/settleUp';
import { SAMPLE_PEOPLE, SAMPLE_RECEIPTS } from '../logic/sampleTrip';

/**
 * Reads the workspace's people and receipts as per-person amounts in the base
 * currency, falling back to a sample trip while there is nothing to settle.
 */
export function useSettleUpTrip() {
  const { initialize, people, receipts } = useReceiptStore(
    useShallow((state) => ({
      initialize: state.initialize,
      people: state.people,
      receipts: state.receipts,
    })),
  );
  const exchangeRates = useCurrencyStore((state) => state.exchangeRates);

  useLayoutEffect(() => {
    initialize();
  }, [initialize]);

  const tripReceipts = useMemo(
    () =>
      receipts.map((receipt): SettleUpReceipt => {
        const split = convertSplitResult(
          computeSplit({
            people,
            items: receipt.items,
            discount: receipt.discount,
            serviceCharge: receipt.serviceCharge,
            gst: receipt.gst,
          }),
          receipt.currency,
          BASE_CURRENCY,
          exchangeRates,
          receipt.exchangeRateOverride,
        );
        return { id: receipt.id, name: receipt.name, owedByPersonCents: split.totalByPersonCents };
      }),
    [people, receipts, exchangeRates],
  );

  const hasSomethingToSettle =
    people.length >= 2 && tripReceipts.some((r) => getReceiptTotalCents(r) > 0);

  if (!hasSomethingToSettle) {
    return { people: SAMPLE_PEOPLE, receipts: SAMPLE_RECEIPTS, isSample: true };
  }
  return { people, receipts: tripReceipts, isSample: false };
}
