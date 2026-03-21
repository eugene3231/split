import { cn } from '../../../../shared/utils/cn'
import type { ChargeMode, ChargeState } from '../../../../shared/types'

interface Props {
  label: string
  value: ChargeState
  onChange: (next: ChargeState) => void
}

export function ChargeToggle({ label, value, onChange }: Props) {
  const isEnabled = value.enabled

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
              'w-10 h-6 rounded-full relative p-1 cursor-pointer transition-colors flex-shrink-0',
              isEnabled ? 'bg-primary' : 'bg-surface-container-highest',
            )}
          >
            <div
              className={cn(
                'w-4 h-4 bg-on-primary rounded-full transition-transform shadow-sm',
                isEnabled ? 'translate-x-4' : 'translate-x-0',
              )}
            />
          </button>
          <span className={cn('font-bold text-sm', isEnabled ? 'text-on-surface' : 'text-on-surface-variant')}>
            {label}
          </span>
        </div>

        {/* $/% mode toggle */}
        <div className={cn('flex items-center bg-surface-container-low rounded-lg p-1', !isEnabled && 'opacity-50')}>
          <button
            type="button"
            onClick={() => isEnabled && onChange({ ...value, mode: 'amount' as ChargeMode })}
            className={cn(
              'px-2 py-0.5 rounded-md text-[10px] font-extrabold transition-all',
              value.mode === 'amount'
                ? 'bg-surface-container-lowest shadow-sm text-primary'
                : 'text-on-surface-variant',
            )}
          >
            $
          </button>
          <button
            type="button"
            onClick={() => isEnabled && onChange({ ...value, mode: 'percent' as ChargeMode })}
            className={cn(
              'px-2 py-0.5 rounded-md text-[10px] font-extrabold transition-all',
              value.mode === 'percent'
                ? 'bg-surface-container-lowest shadow-sm text-primary'
                : 'text-on-surface-variant',
            )}
          >
            %
          </button>
        </div>
      </div>

      {isEnabled && (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-bold text-xs">
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
            className="w-full bg-surface-container-low border-none rounded-xl py-3 pl-7 pr-3 text-sm font-bold text-primary focus:ring-1 focus:ring-primary/20 outline-none"
          />
        </div>
      )}

      {value.detectedSource && (
        <p className="text-[10px] text-on-surface-variant/70">
          Detected via {value.detectedSource}
          {value.detectedConfidence !== null
            ? ` (${Math.round(value.detectedConfidence * 100)}% confidence)`
            : ''}
          . You can override above.
        </p>
      )}
    </div>
  )
}
