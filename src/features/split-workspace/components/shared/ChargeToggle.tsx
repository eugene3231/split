import { cn } from '@shared/utils/cn';
import {
  formatMoneyAmount,
  formatMoneyInput,
  formatPercentInput,
  getCurrencySymbol,
} from '@shared/logic/core/money';
import { FormattedNumberInput } from '@features/split-workspace/components/shared/FormattedNumberInput';
import type { ChargeMode, ChargeState } from '@shared/types';

interface Props {
  label: string;
  value: ChargeState;
  onChange: (next: ChargeState) => void;
  currency: string;
}

export function ChargeToggle({ label, value, onChange, currency }: Props) {
  const isEnabled = value.enabled;
  const isAmount = value.mode === 'amount';
  const currencySymbol = getCurrencySymbol(currency);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Toggle switch */}
          <button
            type="button"
            role="switch"
            aria-checked={isEnabled}
            aria-label={label}
            onClick={() => onChange({ ...value, enabled: !isEnabled })}
            className={cn(
              'relative h-6 w-10 flex-shrink-0 cursor-pointer rounded-full p-1 transition-colors',
              isEnabled ? 'bg-primary' : 'bg-surface-container-highest',
            )}
          >
            <div
              className={cn(
                'h-4 w-4 rounded-full bg-on-primary shadow-sm transition-transform',
                isEnabled ? 'translate-x-4' : 'translate-x-0',
              )}
            />
          </button>
          <span
            className={cn(
              'text-sm font-bold',
              isEnabled ? 'text-on-surface' : 'text-on-surface-variant',
            )}
          >
            {label}
          </span>
        </div>

        {/* amount/% mode toggle */}
        <div
          className={cn(
            'flex items-center rounded-lg bg-surface-container-low p-1',
            !isEnabled && 'opacity-50',
          )}
        >
          <button
            type="button"
            aria-label={`${label} as an amount`}
            aria-pressed={isAmount}
            onClick={() => isEnabled && onChange({ ...value, mode: 'amount' as ChargeMode })}
            className={cn(
              'rounded-md px-2 py-0.5 text-xs font-extrabold transition-all',
              isAmount
                ? 'bg-surface-container-lowest text-primary shadow-sm'
                : 'text-on-surface-variant',
            )}
          >
            {currencySymbol}
          </button>
          <button
            type="button"
            aria-label={`${label} as a percent`}
            aria-pressed={!isAmount}
            onClick={() => isEnabled && onChange({ ...value, mode: 'percent' as ChargeMode })}
            className={cn(
              'rounded-md px-2 py-0.5 text-xs font-extrabold transition-all',
              !isAmount
                ? 'bg-surface-container-lowest text-primary shadow-sm'
                : 'text-on-surface-variant',
            )}
          >
            %
          </button>
        </div>
      </div>

      {isEnabled && (
        <div className="flex items-center gap-1 rounded-xl bg-surface-container-low px-3 focus-within:ring-1 focus-within:ring-primary/20">
          {isAmount && <span className="text-xs font-bold text-primary">{currencySymbol}</span>}
          <FormattedNumberInput
            aria-label={isAmount ? `${label} amount` : `${label} percent`}
            value={isAmount ? value.amountInput : value.percentInput}
            format={isAmount ? (input) => formatMoneyInput(input, currency) : formatPercentInput}
            onValueChange={(input) =>
              onChange(
                isAmount ? { ...value, amountInput: input } : { ...value, percentInput: input },
              )
            }
            placeholder={isAmount ? formatMoneyAmount(0, currency) : '0'}
            className="min-w-0 flex-1 border-none bg-transparent py-3 text-base font-bold text-primary outline-none placeholder:text-outline"
          />
          {!isAmount && <span className="text-xs font-bold text-primary">%</span>}
        </div>
      )}

      {value.detectedSource && (
        <p className="text-xs text-on-surface-variant/70">
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
