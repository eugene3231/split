import { ExportImageSection } from '../../../../features/split-results'
import { SplitTotalsCard } from '../../../../features/split-results/components/SplitTotalsCard'
import { SimplePersonBreakdown } from '../../../../features/split-results/components/SimplePersonBreakdown'
import type { ChargeState, Person, SplitResult } from '../../../../shared/types'

type Props = {
  people: Person[]
  split: SplitResult
  discount: ChargeState
  serviceCharge: ChargeState
  gst: ChargeState
  reconciliationCents: number | null
  onApplyDiscount: () => void
}

export function SimpleStepFinal({
  people,
  split,
  discount,
  serviceCharge,
  gst,
  reconciliationCents,
  onApplyDiscount,
}: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold text-slate-100">Split Result</h2>
      <p className="text-xs text-slate-500">
        Review each person's total, check the receipt difference, then share.
      </p>

      <ExportImageSection
        people={people}
        split={split}
        discount={discount}
        serviceCharge={serviceCharge}
        gst={gst}
        reconciliationCents={reconciliationCents}
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
        <p className="text-sm font-semibold text-slate-200">Per-person breakdown</p>
        <SimplePersonBreakdown
          people={people}
          split={split}
          discount={discount}
          serviceCharge={serviceCharge}
          gst={gst}
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
