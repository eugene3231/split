import type { ChargeState, SplitResult } from '../../../shared/types'
import { formatCurrencyFromCents, parseNumber } from '../../../shared/logic/core/money'
import { SummaryRow } from './SummaryRow'

type SplitTotalsCardProps = {
  split: SplitResult
  discount: ChargeState
  serviceCharge: ChargeState
  gst: ChargeState
  reconciliationCents: number | null
  onApplyDiscount?: () => void
}

export function SplitTotalsCard({ split, discount, serviceCharge, gst, reconciliationCents, onApplyDiscount }: SplitTotalsCardProps) {
  const discountLabel = buildChargeLabel('Whole-Bill Discount', discount)
  const serviceLabel = buildChargeLabel('Service Charge', serviceCharge)
  const gstLabel = buildChargeLabel('GST / Tax', gst)

  return (
    <article className="overflow-hidden rounded-xl border border-white/8 bg-slate-900 shadow-lg shadow-black/20">
      <div className="border-b border-sky-500/50 bg-sky-500/15 px-4 py-3">
        <p className="text-sm font-bold text-slate-100">Total</p>
        <p className="text-lg font-bold text-sky-300">{formatCurrencyFromCents(split.grandTotalCents)}</p>
      </div>
      <div className="space-y-2 p-4 text-sm">
        <SummaryRow label="Subtotal" value={formatCurrencyFromCents(split.subtotalCents)} />
        {split.discountCents > 0 ? (
          <SummaryRow label={discountLabel} value={`−${formatCurrencyFromCents(split.discountCents)}`} tone="ok" />
        ) : null}
        <SummaryRow label={serviceLabel} value={formatCurrencyFromCents(split.serviceChargeCents)} />
        <SummaryRow label={gstLabel} value={formatCurrencyFromCents(split.gstCents)} />
        <SummaryRow
          label="Grand Total"
          value={formatCurrencyFromCents(split.grandTotalCents)}
          emphasized
        />
        {reconciliationCents !== null ? (
          <>
            <SummaryRow
              label="Receipt Difference"
              value={formatCurrencyFromCents(reconciliationCents)}
              tone={reconciliationCents === 0 ? 'ok' : 'warn'}
            />
            {reconciliationCents < 0 && onApplyDiscount ? (
              <button
                type="button"
                data-testid="apply-discount-reconcile-btn"
                onClick={onApplyDiscount}
                className="mt-1 w-full rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20"
              >
                Apply {formatCurrencyFromCents(Math.abs(reconciliationCents))} discount to reconcile
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </article>
  )
}

function buildChargeLabel(label: string, charge: ChargeState): string {
  if (!charge.enabled) {
    return `${label} (off)`
  }

  if (charge.mode === 'percent') {
    const parsed = parseNumber(charge.percentInput)
    if (parsed !== null) {
      return `${label} (${formatPercent(parsed)}%)`
    }
    return `${label} (%)`
  }

  return `${label} (amount)`
}

function formatPercent(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '')
}
