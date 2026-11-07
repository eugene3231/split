import { Switch, ToggleGroup } from 'radix-ui';
import { cn } from '@shared/utils/cn';
import {
  formatMoneyAmount,
  formatMoneyInput,
  formatPercentInput,
  getCurrencySymbol,
} from '@shared/logic/core/money';
import { FormattedNumberInput } from '@features/split-workspace/components/shared/FormattedNumberInput';
import type { ChargeMode, ChargeState } from '@shared/types';
import type { CurrencyCode } from '@shared/constants';

const MODE_ITEM_CLASS =
  'flex h-9 min-w-8 items-center justify-center rounded-lg px-1.5 text-xs font-bold sm:h-8 text-on-surface-variant transition-colors hover:text-on-surface data-[state=on]:bg-surface-container-lowest data-[state=on]:text-on-surface data-[state=on]:shadow-sm';

interface Props {
  label: string;
  value: ChargeState;
  onChange: (next: ChargeState) => void;
  currency: CurrencyCode;
}

export function ChargeToggle({ label, value, onChange, currency }: Props) {
  const isEnabled = value.enabled;
  const isAmount = value.mode === 'amount';
  const currencySymbol = getCurrencySymbol(currency);

  return (
    <div>
      <div className="flex min-h-12 items-center gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Switch.Root
            aria-label={label}
            checked={isEnabled}
            onCheckedChange={(enabled) => onChange({ ...value, enabled })}
            className="relative h-6 w-10 flex-shrink-0 cursor-pointer rounded-full bg-surface-container-highest p-1 transition-colors focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none data-[state=checked]:bg-primary"
          >
            <Switch.Thumb className="block h-4 w-4 rounded-full bg-on-primary shadow-sm transition-transform data-[state=checked]:translate-x-4" />
          </Switch.Root>
          <span
            className={cn(
              'min-w-0 flex-1 text-sm leading-tight font-semibold whitespace-nowrap',
              isEnabled ? 'text-on-surface' : 'text-on-surface-variant',
            )}
          >
            {label}
          </span>
        </div>

        {isEnabled && (
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="flex h-10 w-13 items-center gap-1 field px-2 sm:w-20 sm:px-3">
              <FormattedNumberInput
                aria-label={isAmount ? `${label} amount` : `${label} percent`}
                value={isAmount ? value.amountInput : value.percentInput}
                format={
                  isAmount ? (input) => formatMoneyInput(input, currency) : formatPercentInput
                }
                onValueChange={(input) =>
                  onChange(
                    isAmount ? { ...value, amountInput: input } : { ...value, percentInput: input },
                  )
                }
                placeholder={isAmount ? formatMoneyAmount(0, currency) : '0'}
                className="w-full min-w-0 flex-1 border-none bg-transparent p-0 text-right text-sm font-semibold text-on-surface tabular-nums outline-none placeholder:text-outline"
              />
            </div>
            <ToggleGroup.Root
              type="single"
              aria-label={`How ${label} is entered`}
              value={value.mode}
              onValueChange={(mode: ChargeMode | '') => mode && onChange({ ...value, mode })}
              className="flex shrink-0 items-center rounded-xl bg-surface-container p-0.5 sm:p-1"
            >
              <ToggleGroup.Item
                value="amount"
                aria-label={`${label} as an amount`}
                className={MODE_ITEM_CLASS}
              >
                {currencySymbol}
              </ToggleGroup.Item>
              <ToggleGroup.Item
                value="percent"
                aria-label={`${label} as a percent`}
                className={MODE_ITEM_CLASS}
              >
                %
              </ToggleGroup.Item>
            </ToggleGroup.Root>
          </div>
        )}
      </div>

      {value.detectedSource && (
        <p className="mt-1 pl-13 text-xs text-on-surface-variant">
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
