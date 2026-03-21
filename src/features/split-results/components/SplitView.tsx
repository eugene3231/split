import { useState } from 'react'
import type { ChargeState, Person, SplitResult } from '@shared/types'
import { ExportSplitImageSection } from '@features/split-results/components/ExportSplitImageSection'
import { SplitTotalsCard } from '@features/split-results/components/SplitTotalsCard'
import { SplitPersonBreakdown } from '@features/split-results/components/SplitPersonBreakdown'

type Props = {
  people: Person[]
  split: SplitResult
  discount: ChargeState
  serviceCharge: ChargeState
  gst: ChargeState
  reconciliationCents: number | null
  onApplyDiscount?: () => void
  receiptName?: string
}

export function SplitView({ people, split, discount, serviceCharge, gst, reconciliationCents, onApplyDiscount, receiptName }: Props) {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className="space-y-4">
      <ExportSplitImageSection
        people={people}
        split={split}
        discount={discount}
        serviceCharge={serviceCharge}
        gst={gst}
        reconciliationCents={reconciliationCents}
        receiptName={receiptName}
      />

      <SplitTotalsCard
        split={split}
        discount={discount}
        serviceCharge={serviceCharge}
        gst={gst}
        reconciliationCents={reconciliationCents}
        onApplyDiscount={onApplyDiscount}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-200">Per-person breakdown</p>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition">
            <input
              type="checkbox"
              checked={showDetails}
              onChange={(e) => setShowDetails(e.target.checked)}
              className="accent-sky-400"
            />
            Show details
          </label>
        </div>
        <SplitPersonBreakdown
          people={people}
          split={split}
          discount={discount}
          serviceCharge={serviceCharge}
          gst={gst}
          showDetails={showDetails}
        />
      </div>

      {split.unassignedItemCount > 0 ? (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-xs text-amber-300">
          {split.unassignedItemCount} item(s) are unassigned and not included in person totals.
        </p>
      ) : null}
    </div>
  )
}
