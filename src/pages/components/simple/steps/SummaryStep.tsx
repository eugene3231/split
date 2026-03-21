import { useState } from 'react'
import { SplitView, ConsolidatedSplitView } from '@features/split-results'
import type { ChargeState, Person, Receipt, SplitResult } from '@shared/types'

type Props = {
  people: Person[]
  receipts: Receipt[]
  activeReceiptId: string
  split: SplitResult
  consolidatedSplit: SplitResult
  splitByReceipt: SplitResult[]
  discount: ChargeState
  serviceCharge: ChargeState
  gst: ChargeState
  reconciliationCents: number | null
  onApplyDiscount: () => void
}

export function SummaryStep({
  people,
  receipts,
  split,
  consolidatedSplit,
  splitByReceipt,
  discount,
  serviceCharge,
  gst,
  reconciliationCents,
  onApplyDiscount,
}: Props) {
  const isMultiReceipt = receipts.length > 1
  const [activeTab, setActiveTab] = useState<string>(isMultiReceipt ? 'total' : receipts[0]?.id ?? 'total')

  const activeReceiptIndex = receipts.findIndex((r) => r.id === activeTab)
  const currentSplit = activeTab === 'total' ? consolidatedSplit : (splitByReceipt[activeReceiptIndex] ?? split)
  const currentReceipt = activeTab === 'total' ? null : receipts[activeReceiptIndex]

  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold text-slate-100">Split Result</h2>
      <p className="text-xs text-slate-500">
        Review each person's total, check the receipt difference, then share.
      </p>

      {isMultiReceipt ? (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            data-testid="summary-tab-total"
            onClick={() => setActiveTab('total')}
            className={[
              'rounded-lg border px-3 py-1.5 text-xs font-semibold transition',
              activeTab === 'total'
                ? 'border-sky-500/50 bg-sky-500/15 text-sky-300'
                : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500 hover:text-slate-200',
            ].join(' ')}
          >
            Total ({receipts.length} receipts)
          </button>
          {receipts.map((r, index) => (
            <button
              key={r.id}
              type="button"
              data-testid={`summary-tab-receipt-${index}`}
              onClick={() => setActiveTab(r.id)}
              className={[
                'rounded-lg border px-3 py-1.5 text-xs font-semibold transition',
                activeTab === r.id
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                  : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500 hover:text-slate-200',
              ].join(' ')}
            >
              {r.name || `Receipt ${index + 1}`}
            </button>
          ))}
        </div>
      ) : null}

      {activeTab === 'total' && isMultiReceipt ? (
        <ConsolidatedSplitView
          people={people}
          consolidatedSplit={consolidatedSplit}
          splitByReceipt={splitByReceipt}
          receipts={receipts}
        />
      ) : (
        <SplitView
          people={people}
          split={currentSplit}
          discount={currentReceipt?.discount ?? discount}
          serviceCharge={currentReceipt?.serviceCharge ?? serviceCharge}
          gst={currentReceipt?.gst ?? gst}
          reconciliationCents={activeTab === 'total' ? null : reconciliationCents}
          onApplyDiscount={activeTab === 'total' ? undefined : onApplyDiscount}
          receiptName={currentReceipt?.name}
        />
      )}
    </div>
  )
}
