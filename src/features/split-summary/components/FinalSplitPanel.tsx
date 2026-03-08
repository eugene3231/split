import { useState } from 'react'
import type { ReactNode } from 'react'
import type { ChargeState, Person, SplitResult } from '../../../shared/types'
import { SplitTotalsCard } from './SplitTotalsCard'
import { PersonCard } from '../../receipt-workspace/components/SimplePersonBreakdown'

type FinalSplitPanelProps = {
  people: Person[]
  split: SplitResult
  reconciliationCents: number | null
  discount: ChargeState
  serviceCharge: ChargeState
  gst: ChargeState
  exportSection?: ReactNode
  variant?: 'standalone' | 'embedded'
  onApplyDiscount?: () => void
}

export function FinalSplitPanel({
  people,
  split,
  reconciliationCents,
  discount,
  serviceCharge,
  gst,
  exportSection,
  variant = 'standalone',
  onApplyDiscount,
}: FinalSplitPanelProps) {
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
      <SplitTotalsCard
        split={split}
        discount={discount}
        serviceCharge={serviceCharge}
        gst={gst}
        reconciliationCents={reconciliationCents}
        onApplyDiscount={onApplyDiscount}
      />

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
              discount={discount}
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

