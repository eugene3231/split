import { useEffect, useRef, useState } from 'react'
import type { ChargeState, Person, SplitResult } from '../../../shared/types'
import { generateFinalSplitImage } from '../api/finalSplitImage'
import {
  buildSplitShareText,
  copyShareText,
  downloadImage,
  getShareSupport,
  shareFinalSplit,
} from '../logic/shareSplit'

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
  const [isSharing, setIsSharing] = useState(false)
  const [isDownloadingImage, setIsDownloadingImage] = useState(false)
  const [isCopyingSummary, setIsCopyingSummary] = useState(false)
  const [isSummaryCopied, setIsSummaryCopied] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const copySuccessTimeoutRef = useRef<number | null>(null)

  const shareText = buildSplitShareText({ people, split })
  const shareSupport = getShareSupport()

  useEffect(() => {
    return () => {
      if (copySuccessTimeoutRef.current !== null) {
        window.clearTimeout(copySuccessTimeoutRef.current)
      }
    }
  }, [])

  const getExportBlob = async () => {
    setImageError(null)

    return generateFinalSplitImage({
      people,
      split,
      serviceCharge,
      gst,
      reconciliationCents,
      includeLineItems: includeExportLineItems,
      includeItemDetails: includeExportLineItems && includeExportItemDetails,
    })
  }

  const handleDownloadImage = async () => {
    try {
      setIsDownloadingImage(true)
      setShareError(null)
      setShareMessage(null)
      const blob = await getExportBlob()

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      downloadImage(blob, `split-final-${timestamp}.png`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate image.'
      setImageError(message)
    } finally {
      setIsDownloadingImage(false)
    }
  }

  const handleCopySummary = async () => {
    try {
      setIsCopyingSummary(true)
      setShareError(null)
      setShareMessage(null)
      await copyShareText(shareText)
      setShareMessage('Summary copied.')
      setIsSummaryCopied(true)
      if (copySuccessTimeoutRef.current !== null) {
        window.clearTimeout(copySuccessTimeoutRef.current)
      }
      copySuccessTimeoutRef.current = window.setTimeout(() => {
        setIsSummaryCopied(false)
      }, 2500)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to copy summary.'
      setShareError(message)
    } finally {
      setIsCopyingSummary(false)
    }
  }

  const handleShareSplit = async () => {
    try {
      setIsSharing(true)
      setImageError(null)
      setShareError(null)
      setShareMessage(null)

      const blob = await getExportBlob()
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fileName = `split-final-${timestamp}.png`
      const mode = await shareFinalSplit({
        image: blob,
        fileName,
      })

      if (mode === 'native') {
        setShareMessage('Opened native share.')
        return
      }

      await copyShareText(shareText)
      downloadImage(blob, fileName)
      setShareMessage('Summary copied and image downloaded.')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      const message = error instanceof Error ? error.message : 'Failed to share split.'
      setShareError(message)
    } finally {
      setIsSharing(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Share Split</p>
        <p className="text-xs text-slate-500">
          Share the final split with ready-to-paste text and image summary.
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
            <span className="block font-medium text-slate-100">Show items</span>
            <span className="block text-slate-500">Include each person&apos;s assigned items.</span>
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
            <span className="block font-medium text-slate-100">Show item notes</span>
            <span className="block text-slate-500">Include discount and split notes.</span>
          </span>
        </label>
      </div>

      <div className="space-y-3 border-t border-slate-800 pt-3">
        <div className="text-[11px] text-slate-500">
          {shareSupport === 'native'
            ? 'Share Split will use your device share sheet.'
            : 'Share Split will copy the summary and download the image.'}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleShareSplit}
            disabled={isSharing || isDownloadingImage}
            className="w-full rounded-md border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isSharing ? 'Sharing...' : 'Share Split'}
          </button>
          <button
            type="button"
            onClick={handleCopySummary}
            disabled={isCopyingSummary}
            className={`w-full rounded-md border px-4 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${
              isSummaryCopied
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                : 'border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-500'
            }`}
          >
            {isCopyingSummary ? 'Copying...' : isSummaryCopied ? 'Copied ✓' : 'Copy Summary'}
          </button>
          <button
            type="button"
            onClick={handleDownloadImage}
            disabled={isSharing || isDownloadingImage}
            className="w-full rounded-md border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isDownloadingImage ? 'Downloading...' : 'Download Image'}
          </button>
        </div>
      </div>

      {shareMessage ? <p className="text-xs text-emerald-300">{shareMessage}</p> : null}
      {shareError ? <p className="text-xs text-rose-400">{shareError}</p> : null}
      {imageError ? <p className="text-xs text-rose-400">{imageError}</p> : null}
    </div>
  )
}
