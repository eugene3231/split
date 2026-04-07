import type { ChargeState } from '@shared/types';
import { ChargeControl } from '@features/split-config/components/ChargeControl';

type GlobalChargesSectionProps = {
  discount: ChargeState;
  onDiscountChange: (next: ChargeState) => void;
  serviceCharge: ChargeState;
  onServiceChargeChange: (next: ChargeState) => void;
  gst: ChargeState;
  onGstChange: (next: ChargeState) => void;
  receiptTotalInput: string;
  onReceiptTotalInputChange: (value: string) => void;
};

export function GlobalChargesSection({
  discount,
  onDiscountChange,
  serviceCharge,
  onServiceChargeChange,
  gst,
  onGstChange,
  receiptTotalInput,
  onReceiptTotalInputChange,
}: GlobalChargesSectionProps) {
  return (
    <div className="divide-y divide-slate-700/60 rounded-2xl border border-slate-700/50 bg-slate-800/50">
      <ChargeControl
        label="Whole-Bill Discount"
        description="Applied to the entire bill before charges"
        value={discount}
        onChange={onDiscountChange}
      />
      <ChargeControl
        label="Service Charge"
        value={serviceCharge}
        onChange={onServiceChargeChange}
      />
      <ChargeControl label="GST / Tax" value={gst} onChange={onGstChange} />
      <div className="space-y-1.5 px-4 py-3">
        <label className="text-xs font-medium text-slate-400" htmlFor="receipt-total">
          Receipt Total (optional)
        </label>
        <input
          id="receipt-total"
          inputMode="decimal"
          value={receiptTotalInput}
          onChange={(event) => onReceiptTotalInputChange(event.target.value)}
          placeholder="0.00"
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none ring-sky-400/70 transition focus:ring-2"
        />
        <p className="text-[11px] text-slate-500">
          GST percentage mode is calculated on subtotal + service charge.
        </p>
      </div>
    </div>
  );
}
