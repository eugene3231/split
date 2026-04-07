import type { ChargeState, SplitResult } from '@shared/types';
import { ChargeToggle } from '@pages/components/new/shared/ChargeToggle';
import { SummaryTotals } from '@pages/components/new/shared/SummaryTotals';
import { ReconciliationNotice } from '@pages/components/new/shared/ReconciliationNotice';

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
    <div className="bg-surface-container-lowest p-8 rounded-3xl shadow-lg border border-surface-container-highest sticky top-24">
      <h3 className="text-xl font-bold font-headline text-primary mb-8 border-b border-surface-container-high pb-4">
        Global Charges
      </h3>

      <div className="space-y-6 mb-10">
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
            className="block text-[10px] uppercase font-extrabold text-on-surface-variant tracking-widest mb-2 font-label"
          >
            Receipt Total (Override)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold">
              $
            </span>
            <input
              id="receipt-total-new"
              data-testid="receipt-total-input"
              type="text"
              inputMode="decimal"
              value={receiptTotalInput}
              onChange={(e) => onReceiptTotalInputChange(e.target.value)}
              placeholder="0.00"
              className="w-full bg-surface-container-high border-2 border-transparent focus:border-primary/20 rounded-2xl py-5 pl-8 pr-4 text-3xl font-extrabold font-headline text-on-surface transition-all outline-none"
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
