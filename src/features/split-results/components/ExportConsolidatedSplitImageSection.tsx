import { useRef, useState } from 'react'
import type { Person, Receipt, SplitResult } from '../../../shared/types'
import { generateConsolidatedSplitImage } from '../logic/consolidatedReceiptSplitImage'
import { buildSplitShareText, copyShareText, downloadImage } from '../logic/shareSplit'

type Props = {
  people: Person[]
  consolidatedSplit: SplitResult
  splitByReceipt: SplitResult[]
  receipts: Receipt[]
}

type Busy = 'downloading' | 'copying' | null

export function ExportConsolidatedSplitImageSection({ people, consolidatedSplit, splitByReceipt, receipts }: Props) {
  const [busy, setBusy] = useState<Busy>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const copyTimeoutRef = useRef<number | null>(null)

  const shareText = buildSplitShareText({ people, receiptName: 'Grand Total', split: consolidatedSplit })

  const getBlob = () =>
    generateConsolidatedSplitImage({ people, consolidatedSplit, splitByReceipt, receipts })

  const makeFileName = () =>
    `split-summary-${new Date().toISOString().replace(/[:.]/g, '-')}.png`

  const handleDownload = async () => {
    try {
      setBusy('downloading')
      setError(null)
      downloadImage(await getBlob(), makeFileName())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate image.')
    } finally {
      setBusy(null)
    }
  }

  const handleCopy = async () => {
    try {
      setBusy('copying')
      setError(null)
      await copyShareText(shareText)
      setCopied(true)
      if (copyTimeoutRef.current !== null) window.clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to copy.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/8 bg-slate-900 shadow-lg shadow-black/20">
      <div className="border-b border-emerald-500/50 bg-emerald-500/15 px-4 py-3">
        <p className="text-sm font-bold text-slate-100">Share Split</p>
        <p className="text-xs text-emerald-300">Copy or download the consolidated summary</p>
      </div>
      <div className="space-y-4 p-4">
        <pre className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">
          {shareText}
        </pre>
        <button
          type="button"
          onClick={handleCopy}
          disabled={busy === 'copying'}
          className={`rounded-md border px-4 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
            copied
              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
              : 'border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-500'
          }`}
        >
          {busy === 'copying' ? 'Copying...' : copied ? 'Copied ✓' : 'Copy Text'}
        </button>

        <div className="border-t border-slate-800 pt-3">
          <button
            type="button"
            onClick={handleDownload}
            disabled={busy === 'downloading'}
            className="rounded-md border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === 'downloading' ? 'Saving...' : 'Save Image'}
          </button>
        </div>

        {error ? <p className="text-xs text-rose-400">{error}</p> : null}
      </div>
    </div>
  )
}
