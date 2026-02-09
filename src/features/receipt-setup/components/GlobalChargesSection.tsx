import type { ChargeState } from '../../../shared/types'
import { ChargeControl } from './ChargeControl'

type GlobalChargesSectionProps = {
  serviceCharge: ChargeState
  onServiceChargeChange: (next: ChargeState) => void
  gst: ChargeState
  onGstChange: (next: ChargeState) => void
  receiptTotalInput: string
  onReceiptTotalInputChange: (value: string) => void
}

export function GlobalChargesSection({
  serviceCharge,
  onServiceChargeChange,
  gst,
  onGstChange,
  receiptTotalInput,
  onReceiptTotalInputChange,
}: GlobalChargesSectionProps) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <h3 className="font-medium">Global Charges</h3>
      <ChargeControl label="Service Charge" value={serviceCharge} onChange={onServiceChargeChange} />
      <ChargeControl label="GST / Tax" value={gst} onChange={onGstChange} />
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-300" htmlFor="receipt-total">
          Receipt Total (optional)
        </label>
        <input
          id="receipt-total"
          inputMode="decimal"
          value={receiptTotalInput}
          onChange={(event) => onReceiptTotalInputChange(event.target.value)}
          placeholder="0.00"
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none ring-sky-400 transition focus:ring-2"
        />
      </div>
      <p className="text-xs text-slate-400">
        GST percentage mode is calculated on subtotal + service charge.
      </p>
    </div>
  )
}
