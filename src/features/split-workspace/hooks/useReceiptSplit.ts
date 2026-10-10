import { useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import {
  computeSplit,
  computeConsolidatedSplit,
} from '@features/split-workspace/logic/split/split';
import { useReconciliation } from './useReconciliation';
import { splitUnassignedItemsEqually } from '@features/split-workspace/logic/assignmentInteraction';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { useCurrencyStore } from '@features/split-workspace/stores/currencyStore';
import { BASE_CURRENCY } from '@shared/constants';
import {
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
  defaultTipState,
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
        tip: activeReceipt?.tip ?? defaultTipState,
      }),
    [people, activeReceipt],
  );

  // Receipt-level totals and reconciliation must not change as people claim items, so
  // anything still unclaimed counts as shared here.
  const receiptTotals = useMemo(
    () =>
      computeSplit({
        people,
        items: splitUnassignedItemsEqually(activeReceipt?.items ?? [], people),
        discount: activeReceipt?.discount ?? defaultDiscountState,
        serviceCharge: activeReceipt?.serviceCharge ?? defaultServiceChargeState,
        gst: activeReceipt?.gst ?? defaultGstState,
        tip: activeReceipt?.tip ?? defaultTipState,
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
          tip: r.tip,
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

  const { reconciliationCents, handleApplyReconciliationDiscount } = useReconciliation({
    split: receiptTotals,
    discount: activeReceipt?.discount ?? defaultDiscountState,
    serviceCharge: activeReceipt?.serviceCharge ?? defaultServiceChargeState,
    gst: activeReceipt?.gst ?? defaultGstState,
    setDiscount,
    receiptTotalInput: activeReceipt?.receiptTotalInput ?? '',
  });

  return {
    active: {
      receipt: activeReceipt ?? null,
      split: activeSplit,
      receiptTotals,
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
