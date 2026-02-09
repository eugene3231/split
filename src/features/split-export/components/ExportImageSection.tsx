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
  )
}
