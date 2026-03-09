import { parseCurrencyToCents } from '../logic/core/money'
import type { ChargeState, SplitResult } from '../types'

export function useReconciliation(
  split: SplitResult,
  discount: ChargeState,
  setDiscount: (discount: ChargeState) => void,
  receiptTotalInput: string,
) {
  const receiptTotalCents = parseCurrencyToCents(receiptTotalInput)
  const reconciliationCents =
    receiptTotalCents === null ? null : receiptTotalCents - split.grandTotalCents

  const handleApplyReconciliationDiscount = () => {
    if (reconciliationCents === null || reconciliationCents >= 0) return
    const totalDiscountCents = split.discountCents + Math.abs(reconciliationCents)
    setDiscount({
      ...discount,
      enabled: true,
      mode: 'amount',
      amountInput: (totalDiscountCents / 100).toFixed(2),
    })
  }

  return { reconciliationCents, handleApplyReconciliationDiscount }
}
