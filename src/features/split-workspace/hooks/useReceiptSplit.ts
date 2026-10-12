import { useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import {
  computeSplit,
  computeConsolidatedSplit,
} from '@features/split-workspace/logic/split/split';
import { computeReceiptTotals } from '@features/split-workspace/logic/reconciliation';
import {
  selectActiveReceipt,
  useReceiptStore,
} from '@features/split-workspace/stores/receiptStore';
import { useCurrencyStore } from '@features/split-workspace/stores/currencyStore';
import { BASE_CURRENCY } from '@shared/constants';

export function useReceiptSplit() {
  const { people, receipts } = useReceiptStore(
    useShallow((state) => ({ people: state.people, receipts: state.receipts })),
  );
  const activeReceipt = useReceiptStore(selectActiveReceipt);
  const exchangeRates = useCurrencyStore((state) => state.exchangeRates);

  const activeSplit = useMemo(
    () =>
      computeSplit({
        people,
        items: activeReceipt.items,
        discount: activeReceipt.discount,
        serviceCharge: activeReceipt.serviceCharge,
        gst: activeReceipt.gst,
        roundingInput: activeReceipt.roundingInput,
      }),
    [people, activeReceipt],
  );

  const receiptTotals = useMemo(
    () => computeReceiptTotals(activeReceipt, people),
    [people, activeReceipt],
  );

  const splitByReceipt = useMemo(
    () =>
      receipts.map((r) =>
        computeSplit({
          people,
          items: r.items,
          discount: r.discount,
          serviceCharge: r.serviceCharge,
          gst: r.gst,
          roundingInput: r.roundingInput,
        }),
      ),
    [people, receipts],
  );

  const consolidatedSplit = useMemo(() => {
    const currencies = receipts.map((r) => r.currency);
    const overrides = receipts.map((r) => r.exchangeRateOverride);
    return computeConsolidatedSplit(
      splitByReceipt,
      people,
      currencies,
      exchangeRates,
      overrides,
      BASE_CURRENCY,
    );
  }, [splitByReceipt, people, receipts, exchangeRates]);

  return {
    active: {
      split: activeSplit,
      receiptTotals,
    },
    consolidated: {
      split: consolidatedSplit,
      splitByReceipt,
    },
  };
}
