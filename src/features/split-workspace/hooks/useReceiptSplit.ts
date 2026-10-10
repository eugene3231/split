import { useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import {
  computeSplit,
  computeConsolidatedSplit,
} from '@features/split-workspace/logic/split/split';
import { useReconciliation } from './useReconciliation';
import { computeReceiptTotals } from '@features/split-workspace/logic/reconciliation';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { useCurrencyStore } from '@features/split-workspace/stores/currencyStore';
import { BASE_CURRENCY } from '@shared/constants';
import {
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '@features/split-workspace/constants';

export function useReceiptSplit() {
  const { people, receipts, activeReceiptId, setDiscount, setRoundingInput } = useReceiptStore(
    useShallow((state) => ({
      people: state.people,
      receipts: state.receipts,
      activeReceiptId: state.activeReceiptId,
      setDiscount: state.setDiscount,
      setRoundingInput: state.setRoundingInput,
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
        roundingInput: activeReceipt?.roundingInput,
      }),
    [people, activeReceipt],
  );

  const receiptTotals = useMemo(
    () =>
      computeReceiptTotals(
        activeReceipt ?? {
          items: [],
          discount: defaultDiscountState,
          serviceCharge: defaultServiceChargeState,
          gst: defaultGstState,
          roundingInput: '',
        },
        people,
      ),
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

  const { reconciliationCents, handleApplyReconciliationDiscount, handleAddRounding } =
    useReconciliation({
      split: receiptTotals,
      discount: activeReceipt?.discount ?? defaultDiscountState,
      serviceCharge: activeReceipt?.serviceCharge ?? defaultServiceChargeState,
      gst: activeReceipt?.gst ?? defaultGstState,
      setDiscount,
      setRoundingInput,
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
      addRounding: handleAddRounding,
    },
  };
}
