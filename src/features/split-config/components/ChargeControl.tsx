import type { ChargeMode, ChargeState } from '@shared/types';

type ChargeControlProps = {
  label: string;
  description?: string;
  value: ChargeState;
  onChange: (next: ChargeState) => void;
};

export function ChargeControl({ label, description, value, onChange }: ChargeControlProps) {
  return (
    <div className="space-y-2 px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-200">{label}</p>
          {description ? <p className="text-[11px] text-slate-500">{description}</p> : null}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-400">
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
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none ring-sky-400/70 transition focus:ring-2"
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
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none ring-sky-400/70 transition focus:ring-2"
        />
      </div>
      {value.detectedSource ? (
        <p className="text-[11px] text-slate-500">
          Gemini detected via {value.detectedSource}
          {value.detectedConfidence !== null
            ? ` (${Math.round(value.detectedConfidence * 100)}% confidence)`
            : ''}
          . You can override above.
        </p>
      ) : null}
    </div>
  );
}
