import { formatCurrencyFromCents, parseNumber } from '@shared/logic/core/money'
import type { ChargeState, SplitResult } from '@shared/types'

interface Props {
  split: SplitResult
  discount: ChargeState
  serviceCharge: ChargeState
  gst: ChargeState
  currency?: string
}

function buildChargeLabel(label: string, charge: ChargeState): string {
  if (!charge.enabled) return `${label} (off)`
  if (charge.mode === 'percent') {
    const parsed = parseNumber(charge.percentInput)
    if (parsed !== null) {
      const pct = parsed.toFixed(2).replace(/\.?0+$/, '')
      return `${label} (${pct}%)`
    }
    return `${label} (%)`
  }
  return `${label} (amount)`
}

export function SummaryTotals({ split, discount, serviceCharge, gst, currency }: Props) {
  const activeChargesCents = split.serviceChargeCents + split.gstCents - split.discountCents

  return (
    <div className="space-y-4 pt-6 border-t border-surface-container-high mb-8">
      <div className="flex justify-between items-center text-sm">
        <span className="text-on-surface-variant font-medium">Subtotal</span>
        <span className="font-bold text-on-surface">{formatCurrencyFromCents(split.subtotalCents, currency)}</span>
      </div>
      {split.discountCents > 0 && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-on-surface-variant font-medium">{buildChargeLabel('Discount', discount)}</span>
          <span className="font-bold text-secondary">−{formatCurrencyFromCents(split.discountCents, currency)}</span>
        </div>
      )}
      {(split.serviceChargeCents > 0 || serviceCharge.enabled) && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-on-surface-variant font-medium">{buildChargeLabel('Service Charge', serviceCharge)}</span>
          <span className="font-bold text-primary">+{formatCurrencyFromCents(split.serviceChargeCents, currency)}</span>
        </div>
      )}
      {(split.gstCents > 0 || gst.enabled) && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-on-surface-variant font-medium">{buildChargeLabel('GST / Tax', gst)}</span>
          <span className="font-bold text-primary">+{formatCurrencyFromCents(split.gstCents, currency)}</span>
        </div>
      )}
      {activeChargesCents !== 0 && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-on-surface-variant font-medium">Active Charges</span>
          <span className="font-bold text-primary">
            {activeChargesCents > 0 ? '+' : ''}{formatCurrencyFromCents(activeChargesCents, currency)}
          </span>
        </div>
      )}
      <div className="flex justify-between items-center pt-2">
        <span className="text-base font-extrabold text-primary">Computed Total</span>
        <span className="text-2xl font-extrabold text-primary font-headline">
          {formatCurrencyFromCents(split.grandTotalCents, currency)}
        </span>
      </div>
    </div>
  )
}
