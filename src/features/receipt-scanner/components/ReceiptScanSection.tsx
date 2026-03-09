import { useRef, type ChangeEvent } from 'react'
import { GEMINI_MODELS } from '../../../shared/constants'

type ReceiptScanSectionProps = {
  hasApiKey: boolean
  onEditApiKey: () => void
  geminiModel: string
  onGeminiModelChange: (value: string) => void
  receiptFile: File | null
  onReceiptFileSelected: (file: File | null) => void
  isScanning: boolean
  loadingMessage: string
  scanStatus: string
  scanError: string | null
  scanWarnings: string[]
  onScanReceipt: () => void
  onLoadMockReceipt: () => void
  hideModelInAdvancedSettings?: boolean
  enableCameraCapture?: boolean
  showLoadMockButton?: boolean
}

export function ReceiptScanSection({
  hasApiKey,
  onEditApiKey,
  geminiModel,
  onGeminiModelChange,
  receiptFile,
  onReceiptFileSelected,
  isScanning,
  loadingMessage,
  scanStatus,
  scanError,
  scanWarnings,
  onScanReceipt,
  onLoadMockReceipt,
  hideModelInAdvancedSettings = false,
  enableCameraCapture = false,
  showLoadMockButton = true,
}: ReceiptScanSectionProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const handleReceiptFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    onReceiptFileSelected(event.target.files?.[0] ?? null)
  }

  const handleCameraFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    onReceiptFileSelected(event.target.files?.[0] ?? null)
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-700/50 bg-slate-800/50 p-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-200">Scan Image</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Uses Google Gemini to prefill items and charges.
        </p>

        {/* Gemini API key status indicator — inline below subtitle */}
        <button
          type="button"
          onClick={onEditApiKey}
          className={`mt-2 flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
            hasApiKey
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${hasApiKey ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          {hasApiKey ? (
            <>
              API key added
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className="text-emerald-400/60">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </>
          ) : 'Set up API key'}
        </button>
      </div>

      {hideModelInAdvancedSettings ? (
        <details className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-slate-400 transition hover:text-slate-200">
            Advanced settings
          </summary>
          <div className="mt-2 space-y-1">
            <label className="text-xs font-medium text-slate-300" htmlFor="gemini-model">
              Gemini Model
            </label>
            <select
              id="gemini-model"
              value={geminiModel}
              onChange={(event) => onGeminiModelChange(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none ring-sky-400/70 transition focus:ring-2"
            >
              {GEMINI_MODELS.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </div>
        </details>
      ) : (
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400" htmlFor="gemini-model">
            Gemini Model
          </label>
          <select
            id="gemini-model"
            value={geminiModel}
            onChange={(event) => onGeminiModelChange(event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none ring-sky-400/70 transition focus:ring-2"
          >
            {GEMINI_MODELS.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </div>
      )}

      {/* Secondary action buttons: Browse + Snap Photo */}
      <div className={`grid gap-2 ${enableCameraCapture ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-900/60 px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800">
          Browse
          <input
            type="file"
            data-testid="receipt-file-input"
            accept="image/*,application/pdf"
            onChange={handleReceiptFileChange}
            className="sr-only"
          />
        </label>

        {enableCameraCapture ? (
          <>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleCameraFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-900/60 px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
            >
              Snap Photo
            </button>
          </>
        ) : null}
      </div>

      {/* Primary action: Scan Receipt */}
      <div className={showLoadMockButton ? 'grid gap-2 sm:grid-cols-2' : undefined}>
        <button
          type="button"
          onClick={onScanReceipt}
          disabled={!receiptFile || isScanning}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {isScanning ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-900/20 border-t-emerald-900" />
              Scanning...
            </>
          ) : (
            'Scan Receipt'
          )}
        </button>
        {showLoadMockButton ? (
          <button
            type="button"
            onClick={onLoadMockReceipt}
            disabled={isScanning}
            className="w-full rounded-xl border border-sky-400/40 bg-slate-900 px-3 py-2.5 text-sm font-semibold text-sky-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Load Mock Receipt
          </button>
        ) : null}
      </div>

      {isScanning && loadingMessage ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-3 py-2 text-xs text-emerald-300">
          {loadingMessage}
        </div>
      ) : null}
      {scanStatus ? <p className="text-xs text-slate-400">{scanStatus}</p> : null}
      {scanError ? <p className="text-sm text-rose-400">{scanError}</p> : null}
      {scanWarnings.map((warning) => (
        <p key={warning} className="text-xs text-amber-300">{warning}</p>
      ))}
    </div>
  )
}
