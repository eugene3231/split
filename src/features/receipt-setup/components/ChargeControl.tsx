import type { ChargeMode, ChargeState } from '../../../shared/types'

type ChargeControlProps = {
  label: string
  value: ChargeState
  onChange: (next: ChargeState) => void
}

export function ChargeControl({ label, value, onChange }: ChargeControlProps) {
  return (
    <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-100">{label}</p>
        <label className="inline-flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(event) => onChange({ ...value, enabled: event.target.checked })}
          />
          Include
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_1.2fr]">
        <select
          value={value.mode}
          onChange={(event) => onChange({ ...value, mode: event.target.value as ChargeMode })}
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs outline-none ring-sky-400 transition focus:ring-2"
        >
          <option value="amount">By amount</option>
          <option value="percent">By percent</option>
        </select>
        <input
          inputMode="decimal"
          value={value.mode === 'amount' ? value.amountInput : value.percentInput}
          onChange={(event) =>
            onChange(
              value.mode === 'amount'
                ? { ...value, amountInput: event.target.value }
                : { ...value, percentInput: event.target.value },
            )
          }
          placeholder={value.mode === 'amount' ? '0.00' : '0'}
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs outline-none ring-sky-400 transition focus:ring-2"
        />
      </div>
      {value.detectedSource ? (
        <p className="text-[11px] text-slate-400">
          Gemini detected via {value.detectedSource}
          {value.detectedConfidence !== null
            ? ` (${Math.round(value.detectedConfidence * 100)}% confidence)`
            : ''}
          . You can override above.
        </p>
      ) : null}
    </div>
  )
}
