import { useState } from 'react'
import type { ChargeState, Person, SplitResult } from '../../../shared/types'
import { generateFinalSplitImage } from '../api/finalSplitImage'

type ExportImageSectionProps = {
  people: Person[]
  split: SplitResult
  serviceCharge: ChargeState
  gst: ChargeState
  reconciliationCents: number | null
}

export function ExportImageSection({
  people,
  split,
  serviceCharge,
  gst,
  reconciliationCents,
}: ExportImageSectionProps) {
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
    <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Export Image</p>
        <p className="text-xs text-slate-500">
          Choose what to include in the image, then generate the final shareable summary.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-3 text-xs text-slate-300 transition hover:border-slate-700">
          <input
            type="checkbox"
            checked={includeExportLineItems}
            onChange={(event) => setIncludeExportLineItems(event.target.checked)}
            className="mt-0.5"
          />
          <span className="space-y-1">
            <span className="block font-medium text-slate-100">Include line item breakdown</span>
            <span className="block text-slate-500">
              Show each assigned item under every person in the export image.
            </span>
          </span>
        </label>

        <label
          className={`flex items-start gap-3 rounded-lg border px-3 py-3 text-xs transition ${
            includeExportLineItems
              ? 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700'
              : 'border-slate-800 bg-slate-900/40 text-slate-500'
          }`}
        >
          <input
            type="checkbox"
            checked={includeExportItemDetails}
            onChange={(event) => setIncludeExportItemDetails(event.target.checked)}
            disabled={!includeExportLineItems}
            className="mt-0.5"
          />
          <span className="space-y-1">
            <span className="block font-medium text-slate-100">Include item details</span>
            <span className="block text-slate-500">
              Add discount and split-count notes below each exported line item.
            </span>
          </span>
        </label>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-800 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[11px] text-slate-500">
          {includeExportLineItems
            ? includeExportItemDetails
              ? 'Export will include line items and item details.'
              : 'Export will include line items only.'
            : 'Export will include totals only.'}
        </div>
        <button
          type="button"
          onClick={handleGenerateImage}
          disabled={isGeneratingImage}
          className="w-full rounded-md border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {isGeneratingImage ? 'Generating image...' : 'Generate Final Split Image'}
        </button>
      </div>

      {exportError ? <p className="text-xs text-rose-400">{exportError}</p> : null}
    </div>
  )
}
