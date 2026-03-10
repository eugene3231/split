import { useMemo } from 'react'
import { useShallow } from 'zustand/shallow'
import { computeSplit, computeConsolidatedSplit } from '../logic/computation/split'
import { useReconciliation } from './useReconciliation'
import { useReceiptStore } from '../stores/receiptStore'
import { defaultDiscountState, defaultGstState, defaultServiceChargeState } from '../constants'

export function useReceiptSplit() {
  const { people, receipts, activeReceiptId, setDiscount } = useReceiptStore(
    useShallow((state) => ({
      people: state.people,
      receipts: state.receipts,
      activeReceiptId: state.activeReceiptId,
      setDiscount: state.setDiscount,
    })),
  )

  const activeReceipt = receipts.find((r) => r.id === activeReceiptId) ?? receipts[0]

  const split = useMemo(
    () =>
      computeSplit({
        people,
        items: activeReceipt?.items ?? [],
        discount: activeReceipt?.discount ?? defaultDiscountState,
        serviceCharge: activeReceipt?.serviceCharge ?? defaultServiceChargeState,
        gst: activeReceipt?.gst ?? defaultGstState,
      }),
    [people, activeReceipt],
  )

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
  )

  const consolidatedSplit = useMemo(
    () => computeConsolidatedSplit(splitByReceipt, people),
    [splitByReceipt, people],
  )

  const { reconciliationCents, handleApplyReconciliationDiscount } = useReconciliation(
    split,
    activeReceipt?.discount ?? defaultDiscountState,
    setDiscount,
    activeReceipt?.receiptTotalInput ?? '',
  )

  return { split, consolidatedSplit, splitByReceipt, reconciliationCents, handleApplyReconciliationDiscount }
}
