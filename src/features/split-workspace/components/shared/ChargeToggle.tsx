import { cn } from '@shared/utils/cn';
import type { ChargeMode, ChargeState } from '@shared/types';

interface Props {
  label: string;
  value: ChargeState;
  onChange: (next: ChargeState) => void;
}

export function ChargeToggle({ label, value, onChange }: Props) {
  const isEnabled = value.enabled;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Toggle switch */}
          <button
            type="button"
            role="switch"
            aria-checked={isEnabled}
            onClick={() => onChange({ ...value, enabled: !isEnabled })}
            className={cn(
              'relative h-6 w-10 flex-shrink-0 cursor-pointer rounded-full p-1 transition-colors',
              isEnabled ? 'bg-ink' : 'bg-cream-dim',
            )}
          >
            <div
              className={cn(
                'h-4 w-4 rounded-full bg-on-primary shadow-sm transition-transform',
                isEnabled ? 'translate-x-4' : 'translate-x-0',
              )}
            />
          </button>
          <span className={cn('text-sm font-semibold', isEnabled ? 'text-ink' : 'text-ink2')}>
            {label}
          </span>
        </div>

        {/* $/% mode toggle */}
        <div
          className={cn('flex items-center rounded-full bg-cream p-1', !isEnabled && 'opacity-50')}
        >
          <button
            type="button"
            onClick={() => isEnabled && onChange({ ...value, mode: 'amount' as ChargeMode })}
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-semibold transition-all',
              value.mode === 'amount' ? 'bg-ink text-white shadow-sm' : 'text-ink2',
            )}
          >
            $
          </button>
          <button
            type="button"
            onClick={() => isEnabled && onChange({ ...value, mode: 'percent' as ChargeMode })}
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-semibold transition-all',
              value.mode === 'percent' ? 'bg-ink text-white shadow-sm' : 'text-ink2',
            )}
          >
            %
          </button>
        </div>
      </div>

      {isEnabled && (
        <div className="relative">
          <span className="absolute top-1/2 left-3 -translate-y-1/2 text-xs font-semibold text-ink2">
            {value.mode === 'amount' ? '$' : '%'}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={value.mode === 'amount' ? value.amountInput : value.percentInput}
            onChange={(e) =>
              onChange(
                value.mode === 'amount'
                  ? { ...value, amountInput: e.target.value }
                  : { ...value, percentInput: e.target.value },
              )
            }
            placeholder={value.mode === 'amount' ? '0.00' : '0'}
            className="w-full rounded-xl border-none bg-cream py-3 pr-3 pl-7 text-sm font-semibold text-ink outline-none focus:ring-1 focus:ring-ink/15"
          />
        </div>
      )}

      {value.detectedSource && (
        <p className="text-[10px] text-ink2/70">
          Detected via {value.detectedSource}
          {value.detectedConfidence !== null
            ? ` (${Math.round(value.detectedConfidence * 100)}% confidence)`
            : ''}
          . You can override above.
        </p>
      )}
    </div>
  );
}
