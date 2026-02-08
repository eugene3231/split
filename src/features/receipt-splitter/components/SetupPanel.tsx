import type { ChangeEvent, FormEvent } from 'react'
import { ChargeControl } from './ChargeControl'
import type { ChargeState, Person } from '../types'

type SetupPanelProps = {
  peopleInput: string
  onPeopleInputChange: (value: string) => void
  onPeopleSubmit: (event: FormEvent<HTMLFormElement>) => void
  people: Person[]
  onRemovePerson: (personId: string) => void
  onReceiptFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onScanReceipt: () => void
  onLoadMockReceipt: () => void
  geminiApiKeyInput: string
  onGeminiApiKeyInputChange: (value: string) => void
  rememberGeminiApiKey: boolean
  onRememberGeminiApiKeyChange: (value: boolean) => void
  geminiModel: string
  geminiModels: readonly string[]
  onGeminiModelChange: (value: string) => void
  receiptFile: File | null
  isScanning: boolean
  scanStatus: string
  scanError: string | null
  scanWarnings: string[]
  serviceCharge: ChargeState
  onServiceChargeChange: (next: ChargeState) => void
  gst: ChargeState
  onGstChange: (next: ChargeState) => void
  receiptTotalInput: string
  onReceiptTotalInputChange: (value: string) => void
}

export function SetupPanel({
  peopleInput,
  onPeopleInputChange,
  onPeopleSubmit,
  people,
  onRemovePerson,
  onReceiptFileChange,
  onScanReceipt,
  onLoadMockReceipt,
  geminiApiKeyInput,
  onGeminiApiKeyInputChange,
  rememberGeminiApiKey,
  onRememberGeminiApiKeyChange,
  geminiModel,
  geminiModels,
  onGeminiModelChange,
  receiptFile,
  isScanning,
  scanStatus,
  scanError,
  scanWarnings,
  serviceCharge,
  onServiceChargeChange,
  gst,
  onGstChange,
  receiptTotalInput,
  onReceiptTotalInputChange,
}: SetupPanelProps) {
  return (
    <section className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <h2 className="text-lg font-semibold">Setup</h2>

      <form onSubmit={onPeopleSubmit} className="space-y-3">
        <label className="block text-sm font-medium text-slate-200" htmlFor="people-input">
          People (type names, separated by comma)
        </label>
        <div className="flex gap-2">
          <input
            id="people-input"
            value={peopleInput}
            onChange={(event) => onPeopleInputChange(event.target.value)}
            placeholder="Alice, Ben, Cara"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-sky-400 transition focus:ring-2"
          />
          <button
            type="submit"
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
          >
            Add
          </button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        {people.length === 0 ? (
          <p className="text-sm text-slate-400">No people added yet.</p>
        ) : (
          people.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => onRemovePerson(person.id)}
              className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
              title="Remove person"
            >
              {person.name} ×
            </button>
          ))
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <h3 className="font-medium">Receipt OCR (Gemini)</h3>
        <p className="text-xs text-slate-400">
          Sends your receipt to Gemini for structured extraction. You can override everything.
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
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={rememberGeminiApiKey}
            onChange={(event) => onRememberGeminiApiKeyChange(event.target.checked)}
          />
          Remember API key for this browser session
        </label>
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
            {geminiModels.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={onReceiptFileChange}
          className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-100 hover:file:bg-slate-700"
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onScanReceipt}
            disabled={!receiptFile || isScanning}
            className="w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
          >
            {isScanning ? 'Loading...' : 'Scan Receipt'}
          </button>
          <button
            type="button"
            onClick={onLoadMockReceipt}
            disabled={isScanning}
            className="w-full rounded-lg border border-sky-400/60 bg-slate-900 px-3 py-2 text-sm font-semibold text-sky-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Load Mock Receipt
          </button>
        </div>
        {scanStatus ? <p className="text-xs text-slate-300">{scanStatus}</p> : null}
        {scanError ? <p className="text-sm text-rose-400">{scanError}</p> : null}
        {scanWarnings.map((warning) => (
          <p key={warning} className="text-xs text-amber-300">
            {warning}
          </p>
        ))}
      </div>

      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <h3 className="font-medium">Global Charges</h3>
        <ChargeControl label="Service Charge" value={serviceCharge} onChange={onServiceChargeChange} />
        <ChargeControl label="GST / Tax" value={gst} onChange={onGstChange} />
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-300" htmlFor="receipt-total">
            Receipt Total (optional)
          </label>
          <input
            id="receipt-total"
            inputMode="decimal"
            value={receiptTotalInput}
            onChange={(event) => onReceiptTotalInputChange(event.target.value)}
            placeholder="0.00"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none ring-sky-400 transition focus:ring-2"
          />
        </div>
        <p className="text-xs text-slate-400">
          GST percentage mode is calculated on subtotal + service charge.
        </p>
      </div>
    </section>
  )
}
