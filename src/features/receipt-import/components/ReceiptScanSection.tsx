import { useRef, type ChangeEvent } from 'react'
import { GEMINI_MODELS } from '../../../shared/constants'

type ReceiptScanSectionProps = {
  geminiApiKeyInput: string
  onGeminiApiKeyInputChange: (value: string) => void
  rememberGeminiApiKey: boolean
  onRememberGeminiApiKeyChange: (value: boolean) => void
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
  geminiApiKeyInput,
  onGeminiApiKeyInputChange,
  rememberGeminiApiKey,
  onRememberGeminiApiKeyChange,
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
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <h3 className="font-medium">Scan Image</h3>
      <p className="text-xs text-slate-400">
        Uses Google Gemini to prefill line items, subtotal, service charge, and taxes.
      </p>
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-300" htmlFor="gemini-api-key">
          Gemini API Key
        </label>
        <input
          id="gemini-api-key"
          type="password"
          value={geminiApiKeyInput}
          onChange={(event) => onGeminiApiKeyInputChange(event.target.value)}
          placeholder="AIza..."
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none ring-sky-400 transition focus:ring-2"
        />
        <p className="text-xs text-slate-400">
          Generate your own key at{' '}
          <a
            href="https://aistudio.google.com/app/api-keys"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-sky-300 underline decoration-sky-500/60 underline-offset-2 hover:text-sky-200"
          >
            Google AI Studio
          </a>{' '}
          and paste it above. Your key is stored locally on-device and is used to call Google's
          Gemini APIs only.
        </p>
      </div>
      <label className="inline-flex items-center gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={rememberGeminiApiKey}
          onChange={(event) => onRememberGeminiApiKeyChange(event.target.checked)}
        />
        Remember API key for this browser session
      </label>
      {hideModelInAdvancedSettings ? (
        <details className="rounded-md border border-slate-800 bg-slate-900/50 px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-slate-300">
            Advanced OCR settings
          </summary>
          <div className="mt-2 space-y-1">
            <label className="text-xs font-medium text-slate-300" htmlFor="gemini-model">
              Gemini Model
            </label>
            <select
              id="gemini-model"
              value={geminiModel}
              onChange={(event) => onGeminiModelChange(event.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none ring-sky-400 transition focus:ring-2"
            >
              {GEMINI_MODELS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
        </details>
      ) : (
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-300" htmlFor="gemini-model">
            Gemini Model
          </label>
          <select
            id="gemini-model"
            value={geminiModel}
            onChange={(event) => onGeminiModelChange(event.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none ring-sky-400 transition focus:ring-2"
          >
            {GEMINI_MODELS.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>
      )}
      <input
        type="file"
        accept="image/*,application/pdf"
        onChange={handleReceiptFileChange}
        className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-100 hover:file:bg-slate-700"
      />
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
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-500"
          >
            Snap Photo
          </button>
        </>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onScanReceipt}
          disabled={!receiptFile || isScanning}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
        >
          {isScanning ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-900/20 border-t-emerald-900" />
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
            className="w-full rounded-lg border border-sky-400/60 bg-slate-900 px-3 py-2 text-sm font-semibold text-sky-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Load Mock Receipt
          </button>
        ) : null}
      </div>
      {isScanning && loadingMessage ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {loadingMessage}
        </div>
      ) : null}
      {scanStatus ? <p className="text-xs text-slate-300">{scanStatus}</p> : null}
      {scanError ? <p className="text-sm text-rose-400">{scanError}</p> : null}
      {scanWarnings.map((warning) => (
        <p key={warning} className="text-xs text-amber-300">
          {warning}
        </p>
      ))}
    </div>
  )
}
