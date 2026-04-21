import { useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { computeSplit, computeConsolidatedSplit } from '@shared/logic/split/split';
import { useReconciliation } from './useReconciliation';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { useCurrencyStore } from '@features/split-workspace/stores/currencyStore';
import { BASE_CURRENCY } from '@shared/constants';
import {
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '@features/split-workspace/constants';

export function useReceiptSplit() {
  const { people, receipts, activeReceiptId, setDiscount } = useReceiptStore(
    useShallow((state) => ({
      people: state.people,
      receipts: state.receipts,
      activeReceiptId: state.activeReceiptId,
      setDiscount: state.setDiscount,
    })),
  );
  const exchangeRates = useCurrencyStore((state) => state.exchangeRates);

  const activeReceipt = receipts.find((r) => r.id === activeReceiptId) ?? receipts[0];

  const activeSplit = useMemo(
    () =>
      computeSplit({
        people,
        items: activeReceipt?.items ?? [],
        discount: activeReceipt?.discount ?? defaultDiscountState,
        serviceCharge: activeReceipt?.serviceCharge ?? defaultServiceChargeState,
        gst: activeReceipt?.gst ?? defaultGstState,
      }),
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
        }),
      ),
    [people, receipts],
  );

  const consolidatedSplit = useMemo(() => {
    const currencies = receipts.map((r) => r.currency ?? BASE_CURRENCY);
    const overrides = receipts.map((r) => r.exchangeRateOverride ?? null);
    return computeConsolidatedSplit(
      splitByReceipt,
      people,
      currencies,
      exchangeRates,
      overrides,
      BASE_CURRENCY,
    );
  }, [splitByReceipt, people, receipts, exchangeRates]);

  const { reconciliationCents, handleApplyReconciliationDiscount } = useReconciliation(
    activeSplit,
    activeReceipt?.discount ?? defaultDiscountState,
    setDiscount,
    activeReceipt?.receiptTotalInput ?? '',
  );

  return {
    active: {
      receipt: activeReceipt ?? null,
      split: activeSplit,
    },
    consolidated: {
      split: consolidatedSplit,
      splitByReceipt,
    },
    reconciliation: {
      cents: reconciliationCents,
      applyCorrectiveDiscount: handleApplyReconciliationDiscount,
    },
  };
}
