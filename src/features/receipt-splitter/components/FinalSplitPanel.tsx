import { useState } from 'react'
import type { ChargeState, Person, PersonReceiptLineItem, SplitResult } from '../types'
import { formatCurrencyFromCents, parseNumber } from '../logic/core/money'
import { SummaryRow } from './SummaryRow'
import { generateFinalSplitImage } from '../logic/export/finalSplitImage'

type FinalSplitPanelProps = {
  people: Person[]
  split: SplitResult
  reconciliationCents: number | null
  serviceCharge: ChargeState
  gst: ChargeState
}

export function FinalSplitPanel({
  people,
  split,
  reconciliationCents,
  serviceCharge,
  gst,
}: FinalSplitPanelProps) {
  const serviceLabel = buildChargeLabel('Service Charge', serviceCharge)
  const gstLabel = buildChargeLabel('GST / Tax', gst)
  const [showItemMeta, setShowItemMeta] = useState(true)
  const [includeExportLineItems, setIncludeExportLineItems] = useState(true)
  const [includeExportItemDetails, setIncludeExportItemDetails] = useState(true)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const handleGenerateImage = async () => {
    try {
      setIsGeneratingImage(true)
      setExportError(null)

      const blob = await generateFinalSplitImage({
        people,
        split,
        serviceCharge,
        gst,
        reconciliationCents,
        includeLineItems: includeExportLineItems,
        includeItemDetails: includeExportLineItems && includeExportItemDetails,
      })

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `split-final-${timestamp}.png`
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate image.'
      setExportError(message)
    } finally {
      setIsGeneratingImage(false)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Final Split</h2>
        <button
          type="button"
          onClick={() => setShowItemMeta((current) => !current)}
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
        >
          {showItemMeta ? 'Hide item details' : 'Show item details'}
        </button>
      </div>
      <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Export Image</p>
        <label className="inline-flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={includeExportLineItems}
            onChange={(event) => setIncludeExportLineItems(event.target.checked)}
          />
          Include line item breakdown
        </label>
        <label className="inline-flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={includeExportItemDetails}
            onChange={(event) => setIncludeExportItemDetails(event.target.checked)}
            disabled={!includeExportLineItems}
          />
          Include item details (discount and split among)
        </label>
        <button
          type="button"
          onClick={handleGenerateImage}
          disabled={isGeneratingImage}
          className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isGeneratingImage ? 'Generating image...' : 'Generate Final Split Image'}
        </button>
        {exportError ? <p className="text-xs text-rose-400">{exportError}</p> : null}
      </div>
      <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm">
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

      <div className="space-y-3">
        {people.length === 0 ? (
          <p className="text-sm text-slate-400">Add people to see totals.</p>
        ) : (
          people.map((person) => {
            const personLines = split.lineItemsByPerson[person.id] ?? []

            return (
              <article
                key={person.id}
                className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm"
              >
                <p className="font-semibold text-slate-100">{person.name}</p>
                <div className="space-y-1.5">
                  {personLines.length === 0 ? (
                    <p className="text-xs text-slate-400">No assigned line items yet.</p>
                  ) : (
                    personLines.map((line, index) => (
                      <div key={`${line.itemId}-${index}`} className="space-y-0.5">
                        <div className="flex items-center justify-between gap-3 text-xs leading-tight">
                          <p className="truncate text-slate-300">{line.name}</p>
                          <p className="shrink-0 font-medium text-slate-100">
                            {formatCurrencyFromCents(line.assignedAmountCents)}
                          </p>
                        </div>
                        {showItemMeta ? (
                          <p className="pl-4 text-[10px] leading-tight text-slate-500">
                            {buildItemSubMeta(line)}
                          </p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
                <div className="border-t border-slate-800" />
                <SummaryRow
                  label="Items"
                  value={formatCurrencyFromCents(split.subtotalByPersonCents[person.id] ?? 0)}
                />
                <SummaryRow
                  label={buildChargeLabel('Service', serviceCharge)}
                  value={formatCurrencyFromCents(split.serviceByPersonCents[person.id] ?? 0)}
                />
                <SummaryRow
                  label={buildChargeLabel('GST', gst)}
                  value={formatCurrencyFromCents(split.gstByPersonCents[person.id] ?? 0)}
                />
                <SummaryRow
                  label="Pay"
                  value={formatCurrencyFromCents(split.totalByPersonCents[person.id] ?? 0)}
                  emphasized
                />
              </article>
            )
          })
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

function buildItemSubMeta(line: PersonReceiptLineItem): string {
  const details: string[] = []
  if (line.discountAmountCents > 0) {
    details.push(`discount ${formatPercent(line.discountPercent)}%`)
  }
  details.push(`split among ${line.splitCount}`)
  return details.join(' • ')
}

function formatPercent(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '')
}
