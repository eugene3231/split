import { findReconciliationDiscount } from '../logic/reconciliation';
import { parseCurrencyToCents } from '@shared/logic/core/money';
import type { ChargeState, SplitResult } from '@shared/types';

interface ReconciliationInput {
  split: SplitResult;
  discount: ChargeState;
  serviceCharge: ChargeState;
  gst: ChargeState;
  setDiscount: (discount: ChargeState) => void;
  receiptTotalInput: string;
}

export function useReconciliation({
  split,
  discount,
  serviceCharge,
  gst,
  setDiscount,
  receiptTotalInput,
}: ReconciliationInput) {
  const receiptTotalCents = parseCurrencyToCents(receiptTotalInput);
  const reconciliationCents =
    receiptTotalCents === null ? null : receiptTotalCents - split.grandTotalCents;

  const handleApplyReconciliationDiscount = () => {
    if (receiptTotalCents === null || reconciliationCents === null || reconciliationCents >= 0)
      return;
    const totalDiscountCents = findReconciliationDiscount({
      subtotalCents: split.subtotalCents,
      currentDiscountCents: split.discountCents,
      serviceCharge,
      gst,
      targetTotalCents: receiptTotalCents,
    });
    if (totalDiscountCents === null) return;
    setDiscount({
      ...discount,
      enabled: true,
      mode: 'amount',
      amountInput: (totalDiscountCents / 100).toFixed(2),
    });
  };

  return { reconciliationCents, handleApplyReconciliationDiscount };
}
