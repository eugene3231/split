import { useState } from 'react'
import type { ReactNode } from 'react'
import type { ChargeState, Person, SplitResult } from '../../../shared/types'
import { formatCurrencyFromCents, parseNumber } from '../../../shared/logic/core/money'
import { SummaryRow } from './SummaryRow'
import { PersonCard } from '../../receipt-workspace/components/SimplePersonBreakdown'

type FinalSplitPanelProps = {
  people: Person[]
  split: SplitResult
  reconciliationCents: number | null
  serviceCharge: ChargeState
  gst: ChargeState
  exportSection?: ReactNode
  variant?: 'standalone' | 'embedded'
}

export function FinalSplitPanel({
  people,
  split,
  reconciliationCents,
  serviceCharge,
  gst,
  exportSection,
  variant = 'standalone',
}: FinalSplitPanelProps) {
  const serviceLabel = buildChargeLabel('Service Charge', serviceCharge)
  const gstLabel = buildChargeLabel('GST / Tax', gst)
  const [showItemMeta, setShowItemMeta] = useState(true)

  return (
    <section
      className={
        variant === 'embedded'
          ? 'space-y-4'
          : 'space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5'
      }
    >
      {variant === 'standalone' ? <h2 className="text-lg font-semibold">Final Split</h2> : null}
      {exportSection}
      <article className="overflow-hidden rounded-xl border border-white/8 bg-slate-900 shadow-lg shadow-black/20">
        <div className="border-b border-sky-500/50 bg-sky-500/15 px-4 py-3">
          <p className="text-sm font-bold text-slate-100">Total</p>
          <p className="text-lg font-bold text-sky-300">{formatCurrencyFromCents(split.grandTotalCents)}</p>
        </div>
        <div className="space-y-2 p-4 text-sm">
          <SummaryRow label="Subtotal" value={formatCurrencyFromCents(split.subtotalCents)} />
          <SummaryRow label={serviceLabel} value={formatCurrencyFromCents(split.serviceChargeCents)} />
          <SummaryRow label={gstLabel} value={formatCurrencyFromCents(split.gstCents)} />
          <SummaryRow
            label="Grand Total"
            value={formatCurrencyFromCents(split.grandTotalCents)}
            emphasized
          />
          {reconciliationCents !== null ? (
            <SummaryRow
              label="Receipt Difference"
              value={formatCurrencyFromCents(reconciliationCents)}
              tone={reconciliationCents === 0 ? 'ok' : 'warn'}
            />
          ) : null}
        </div>
      </article>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-200">Per-person breakdown</p>
          <button
            type="button"
            onClick={() => setShowItemMeta((current) => !current)}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
          >
            {showItemMeta ? 'Hide item details' : 'Show item details'}
          </button>
        </div>
        {people.length === 0 ? (
          <p className="text-sm text-slate-400">Add people to see totals.</p>
        ) : (
          people.map((person, index) => (
            <PersonCard
              key={person.id}
              person={person}
              colorIndex={index}
              split={split}
              serviceCharge={serviceCharge}
              gst={gst}
              showItemMeta={showItemMeta}
            />
          ))
        )}
      </div>

      {split.unassignedItemCount > 0 ? (
        <p className="rounded-lg border border-amber-700/60 bg-amber-900/20 px-3 py-2 text-xs text-amber-200">
          {split.unassignedItemCount} item(s) are unassigned and not included in person totals yet.
        </p>
      ) : null}
    </section>
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
