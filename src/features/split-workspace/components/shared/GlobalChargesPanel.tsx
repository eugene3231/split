import type { ChargeState, SplitResult } from '@shared/types';
import { ChargeToggle } from '@features/split-workspace/components/shared/ChargeToggle';
import { SummaryTotals } from '@features/split-workspace/components/shared/SummaryTotals';
import { ReconciliationNotice } from '@features/split-workspace/components/shared/ReconciliationNotice';
import { formatMoneyAmount, formatMoneyInput, getCurrencySymbol } from '@shared/logic/core/money';
import { FormattedNumberInput } from '@features/split-workspace/components/shared/FormattedNumberInput';
import { BASE_CURRENCY } from '@shared/constants';

interface Props {
  split: SplitResult;
  discount: ChargeState;
  serviceCharge: ChargeState;
  gst: ChargeState;
  reconciliationCents: number | null;
  receiptTotalInput: string;
  onApplyDiscount: () => void;
  onAddRounding: () => void;
  onRemoveRounding: () => void;
  onDiscountChange: (discount: ChargeState) => void;
  onServiceChargeChange: (serviceCharge: ChargeState) => void;
  onGstChange: (gst: ChargeState) => void;
  onReceiptTotalInputChange: (value: string) => void;
  currency?: string;
}

export function GlobalChargesPanel({
  split,
  discount,
  serviceCharge,
  gst,
  reconciliationCents,
  receiptTotalInput,
  onApplyDiscount,
  onAddRounding,
  onRemoveRounding,
  onDiscountChange,
  onServiceChargeChange,
  onGstChange,
  onReceiptTotalInputChange,
  currency = BASE_CURRENCY,
}: Props) {
  return (
    <div className="sticky top-24 rounded-3xl border border-surface-container-highest bg-surface-container-lowest p-6 shadow-lg md:p-8">
      <h3 className="mb-6 border-b border-surface-container-high pb-4 font-headline text-xl font-bold text-primary">
        Global Charges
      </h3>

      <div className="mb-8 space-y-6">
        <ChargeToggle
          label="Global Discount"
          value={discount}
          onChange={onDiscountChange}
          currency={currency}
        />
        <ChargeToggle
          label="Service Charge"
          value={serviceCharge}
          onChange={onServiceChargeChange}
          currency={currency}
        />
        <ChargeToggle label="GST / Tax" value={gst} onChange={onGstChange} currency={currency} />
      </div>

      <SummaryTotals
        split={split}
        discount={discount}
        serviceCharge={serviceCharge}
        gst={gst}
        currency={currency}
        onRemoveRounding={onRemoveRounding}
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
              value={receiptTotalInput}
              format={(input) => formatMoneyInput(input, currency)}
              onValueChange={onReceiptTotalInputChange}
              placeholder={formatMoneyAmount(0, currency)}
              className="min-w-0 flex-1 border-none bg-transparent py-3 font-headline text-xl font-extrabold text-on-surface outline-none placeholder:text-outline"
            />
          </div>
        </div>

        <ReconciliationNotice
          reconciliationCents={reconciliationCents}
          onApplyDiscount={onApplyDiscount}
          onAddRounding={onAddRounding}
          currency={currency}
        />
      </div>
    </div>
  );
}
