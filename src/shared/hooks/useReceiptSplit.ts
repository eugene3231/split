import { useMemo } from 'react'
import { useShallow } from 'zustand/shallow'
import { computeSplit } from '../logic/computation/split'
import { useReconciliation } from './useReconciliation'
import { useReceiptStore } from '../stores/receiptStore'

export function useReceiptSplit() {
  const { people, items, discount, serviceCharge, gst, receiptTotalInput, setDiscount } =
    useReceiptStore(
      useShallow((state) => ({
        people: state.people,
        items: state.items,
        discount: state.discount,
        serviceCharge: state.serviceCharge,
        gst: state.gst,
        receiptTotalInput: state.receiptTotalInput,
        setDiscount: state.setDiscount,
      })),
    )

  const split = useMemo(
    () => computeSplit({ people, items, discount, serviceCharge, gst }),
    [people, items, discount, serviceCharge, gst],
  )

  const { reconciliationCents, handleApplyReconciliationDiscount } = useReconciliation(
    split,
    discount,
    setDiscount,
    receiptTotalInput,
  )

  return { split, reconciliationCents, handleApplyReconciliationDiscount }
}
