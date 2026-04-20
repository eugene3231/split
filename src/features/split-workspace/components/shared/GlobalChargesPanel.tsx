import type { ChargeState, SplitResult } from '@shared/types';
import { ChargeToggle } from '@features/split-workspace/components/shared/ChargeToggle';
import { SummaryTotals } from '@features/split-workspace/components/shared/SummaryTotals';
import { ReconciliationNotice } from '@features/split-workspace/components/shared/ReconciliationNotice';
import { getCurrencySymbol } from '@shared/logic/core/money';
import { BASE_CURRENCY } from '@shared/constants';

interface Props {
  split: SplitResult;
  discount: ChargeState;
  serviceCharge: ChargeState;
  gst: ChargeState;
  reconciliationCents: number | null;
  receiptTotalInput: string;
  onApplyDiscount: () => void;
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
  onDiscountChange,
  onServiceChargeChange,
  onGstChange,
  onReceiptTotalInputChange,
  currency,
}: Props) {
  return (
    <div className="sticky top-24 rounded-3xl border border-surface-container-highest bg-surface-container-lowest p-8 shadow-lg">
      <h3 className="font-headline mb-8 border-b border-surface-container-high pb-4 text-xl font-bold text-primary">
        Global Charges
      </h3>

      <div className="mb-10 space-y-6">
        <ChargeToggle label="GST / Tax" value={gst} onChange={onGstChange} />
        <ChargeToggle
          label="Service Charge"
          value={serviceCharge}
          onChange={onServiceChargeChange}
        />
        <ChargeToggle label="Global Discount" value={discount} onChange={onDiscountChange} />
      </div>

      <SummaryTotals
        split={split}
        discount={discount}
        serviceCharge={serviceCharge}
        gst={gst}
        currency={currency}
      />

      {/* Receipt Total input */}
      <div className="space-y-4">
        <div>
          <label
            htmlFor="receipt-total-new"
            className="font-label mb-2 block text-[10px] font-extrabold tracking-widest text-on-surface-variant uppercase"
          >
            Receipt Total (Override)
          </label>
          <div className="relative">
            <span className="absolute top-1/2 left-4 -translate-y-1/2 font-bold text-on-surface-variant">
              {getCurrencySymbol(currency ?? BASE_CURRENCY)}
            </span>
            <input
              id="receipt-total-new"
              data-testid="receipt-total-input"
              type="text"
              inputMode="decimal"
              value={receiptTotalInput}
              onChange={(e) => onReceiptTotalInputChange(e.target.value)}
              placeholder="0.00"
              className="font-headline w-full rounded-2xl border-2 border-transparent bg-surface-container-high py-5 pr-4 pl-8 pl-12 text-3xl font-extrabold text-on-surface transition-all outline-none focus:border-primary/20"
            />
          </div>
        </div>

        <ReconciliationNotice
          reconciliationCents={reconciliationCents}
          onApplyDiscount={onApplyDiscount}
        />
      </div>
    </div>
  );
}
