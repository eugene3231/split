import type { Receipt } from '@shared/types';
import { ChargeToggle } from '@features/split-workspace/components/shared/ChargeToggle';
import { SummaryTotals } from '@features/split-workspace/components/shared/SummaryTotals';
import { ReconciliationNotice } from '@features/split-workspace/components/shared/ReconciliationNotice';
import { formatMoneyAmount, formatMoneyInput, getCurrencySymbol } from '@shared/logic/core/money';
import { FormattedNumberInput } from '@features/split-workspace/components/shared/FormattedNumberInput';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import {
  computeReceiptTotals,
  resolveReconciliation,
} from '@features/split-workspace/logic/reconciliation';

interface Props {
  receipt: Receipt;
}

export function GlobalChargesPanel({ receipt }: Props) {
  const people = useReceiptStore((state) => state.people);
  const patchReceipt = useReceiptStore((state) => state.patchReceipt);
  const { id, discount, serviceCharge, gst, currency } = receipt;

  return (
    <div className="sticky top-[calc(var(--app-bar-height)+1.5rem)] rounded-3xl border border-surface-container-highest bg-surface-container-lowest p-6 shadow-lg md:p-8">
      <h3 className="mb-6 border-b border-surface-container-high pb-4 font-headline text-xl font-bold text-primary">
        Global Charges
      </h3>

      <div className="mb-8 space-y-6">
        <ChargeToggle
          label="Global Discount"
          value={discount}
          onChange={(next) => patchReceipt(id, { discount: next })}
          currency={currency}
        />
        <ChargeToggle
          label="Service Charge"
          value={serviceCharge}
          onChange={(next) => patchReceipt(id, { serviceCharge: next })}
          currency={currency}
        />
        <ChargeToggle
          label="GST / Tax"
          value={gst}
          onChange={(next) => patchReceipt(id, { gst: next })}
          currency={currency}
        />
      </div>

      <SummaryTotals
        totals={computeReceiptTotals(receipt, people)}
        charges={receipt}
        currency={currency}
        onRemoveRounding={() => patchReceipt(id, { roundingInput: '' })}
      />

      <div className="space-y-4">
        <div>
          <label
            htmlFor="receipt-total-new"
            className="mb-2 block font-label text-xs font-extrabold tracking-widest text-on-surface-variant uppercase"
          >
            Receipt Total (Override)
          </label>
          <div className="flex items-center gap-2 rounded-2xl border-2 border-transparent bg-surface-container-high px-4 transition-all focus-within:border-primary/20">
            <span className="font-bold text-on-surface-variant">{getCurrencySymbol(currency)}</span>
            <FormattedNumberInput
              id="receipt-total-new"
              data-testid="receipt-total-input"
              value={receipt.receiptTotalInput}
              format={(input) => formatMoneyInput(input, currency)}
              onValueChange={(value) => patchReceipt(id, { receiptTotalInput: value })}
              placeholder={formatMoneyAmount(0, currency)}
              className="min-w-0 flex-1 border-none bg-transparent py-3 font-headline text-xl font-extrabold text-on-surface outline-none placeholder:text-outline"
            />
          </div>
        </div>

        <ReconciliationNotice
          reconciliation={resolveReconciliation(receipt, people)}
          currency={currency}
          onApplyFix={(fix) => patchReceipt(id, fix)}
        />
      </div>
    </div>
  );
}
