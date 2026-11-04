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
    <section
      aria-labelledby="receipt-charges-heading"
      className="surface-card p-5 md:p-6 lg:sticky lg:top-[calc(var(--app-bar-height)+1.5rem)]"
    >
      <h2
        id="receipt-charges-heading"
        className="mb-3 font-headline text-lg leading-tight font-bold text-on-surface"
      >
        Charges
      </h2>

      <div className="space-y-2">
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

      <div className="space-y-3 border-t border-surface-container-high pt-5">
        <div>
          <label htmlFor="receipt-total-new" className="block section-label">
            Printed total
          </label>
          <p className="mb-2 text-xs text-on-surface-variant">
            The total on the receipt, to check the items against.
          </p>
          <div className="flex h-12 items-center gap-2 field px-4">
            <span className="text-on-surface-variant">{getCurrencySymbol(currency)}</span>
            <FormattedNumberInput
              id="receipt-total-new"
              data-testid="receipt-total-input"
              value={receipt.receiptTotalInput}
              format={(input) => formatMoneyInput(input, currency)}
              onValueChange={(value) => patchReceipt(id, { receiptTotalInput: value })}
              placeholder={formatMoneyAmount(0, currency)}
              className="min-w-0 flex-1 border-none bg-transparent font-headline text-xl font-bold text-on-surface tabular-nums outline-none placeholder:text-outline"
            />
          </div>
        </div>

        <ReconciliationNotice
          reconciliation={resolveReconciliation(receipt, people)}
          currency={currency}
          onApplyFix={(fix) => patchReceipt(id, fix)}
        />
      </div>
    </section>
  );
}
