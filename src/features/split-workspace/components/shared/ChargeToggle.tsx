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
  'rounded-md px-2 py-0.5 text-xs font-extrabold text-on-surface-variant transition-all data-[state=on]:bg-surface-container-lowest data-[state=on]:text-primary data-[state=on]:shadow-sm';

interface ChargeFieldProps {
  label: string;
  value: ChargeState;
  onChange: (next: ChargeState) => void;
  currency: CurrencyCode;
}

export function ChargeToggle({ label, value, onChange, currency }: ChargeFieldProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <ChargeSwitch
          label={label}
          checked={value.enabled}
          onCheckedChange={(enabled) => onChange({ ...value, enabled })}
        />
        <ChargeModeToggle label={label} value={value} onChange={onChange} currency={currency} />
      </div>

      {value.enabled && (
        <ChargeValueInput label={label} value={value} onChange={onChange} currency={currency} />
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

interface ChargeSwitchProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function ChargeSwitch({ label, checked, onCheckedChange }: ChargeSwitchProps) {
  return (
    <div className="flex items-center gap-3">
      <Switch.Root
        aria-label={label}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="relative h-6 w-10 flex-shrink-0 cursor-pointer rounded-full bg-surface-container-highest p-1 transition-colors data-[state=checked]:bg-primary"
      >
        <Switch.Thumb className="block h-4 w-4 rounded-full bg-on-primary shadow-sm transition-transform data-[state=checked]:translate-x-4" />
      </Switch.Root>
      <span
        className={cn('text-sm font-bold', checked ? 'text-on-surface' : 'text-on-surface-variant')}
      >
        {label}
      </span>
    </div>
  );
}

export function ChargeModeToggle({ label, value, onChange, currency }: ChargeFieldProps) {
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={`How ${label} is entered`}
      disabled={!value.enabled}
      value={value.mode}
      onValueChange={(mode: ChargeMode | '') => mode && onChange({ ...value, mode })}
      className={cn(
        'flex items-center rounded-lg bg-surface-container-low p-1',
        !value.enabled && 'opacity-50',
      )}
    >
      <ToggleGroup.Item
        value="amount"
        aria-label={`${label} as an amount`}
        className={MODE_ITEM_CLASS}
      >
        {getCurrencySymbol(currency)}
      </ToggleGroup.Item>
      <ToggleGroup.Item
        value="percent"
        aria-label={`${label} as a percent`}
        className={MODE_ITEM_CLASS}
      >
        %
      </ToggleGroup.Item>
    </ToggleGroup.Root>
  );
}

export function ChargeValueInput({ label, value, onChange, currency }: ChargeFieldProps) {
  const isAmount = value.mode === 'amount';
  return (
    <div className="flex items-center gap-1 rounded-xl bg-surface-container-low px-3 focus-within:ring-1 focus-within:ring-primary/20">
      {isAmount && (
        <span className="text-xs font-bold text-primary">{getCurrencySymbol(currency)}</span>
      )}
      <FormattedNumberInput
        aria-label={isAmount ? `${label} amount` : `${label} percent`}
        value={isAmount ? value.amountInput : value.percentInput}
        format={isAmount ? (input) => formatMoneyInput(input, currency) : formatPercentInput}
        onValueChange={(input) =>
          onChange(isAmount ? { ...value, amountInput: input } : { ...value, percentInput: input })
        }
        placeholder={isAmount ? formatMoneyAmount(0, currency) : '0'}
        className="min-w-0 flex-1 border-none bg-transparent py-3 text-base font-bold text-primary outline-none placeholder:text-outline"
      />
      {!isAmount && <span className="text-xs font-bold text-primary">%</span>}
    </div>
  );
}
