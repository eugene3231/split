import type { ReactNode } from 'react';
import { cn } from '@shared/utils/cn';
import { getCurrencySymbol } from '@shared/logic/core/money';
import type { ChargeState } from '@shared/types';
import { TIP_PERCENT_PRESETS } from '@features/split-workspace/constants';

interface Props {
  value: ChargeState;
  onChange: (next: ChargeState) => void;
  currency: string;
}

export function TipPicker({ value, onChange, currency }: Props) {
  const isAmount = value.enabled && value.mode === 'amount';

  return (
    <div className="space-y-3" data-testid="tip-picker">
      <div>
        <span className="text-sm font-bold text-on-surface">Tip</span>
        <p className="text-xs text-on-surface-variant">
          Added after GST and split by what each person had.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <TipOption
          pressed={!value.enabled}
          onClick={() => onChange({ ...value, enabled: false })}
          testId="tip-none"
        >
          None
        </TipOption>
        {TIP_PERCENT_PRESETS.map((percent) => (
          <TipOption
            key={percent}
            pressed={value.enabled && value.mode === 'percent' && value.percentInput === percent}
            onClick={() =>
              onChange({ ...value, enabled: true, mode: 'percent', percentInput: percent })
            }
            testId={`tip-${percent}`}
          >
            {percent}%
          </TipOption>
        ))}
        <label
          className={cn(
            'flex min-w-24 flex-1 items-center gap-1 rounded-full border px-3 py-1 text-sm font-semibold',
            isAmount ? 'border-primary' : 'border-outline-variant',
          )}
        >
          <span className="text-on-surface-variant">{getCurrencySymbol(currency)}</span>
          <input
            type="text"
            inputMode="decimal"
            aria-label="Tip amount"
            data-testid="tip-amount-input"
            value={isAmount ? value.amountInput : ''}
            placeholder="Amount"
            onChange={(event) =>
              onChange({
                ...value,
                enabled: event.target.value !== '',
                mode: 'amount',
                amountInput: event.target.value,
              })
            }
            className="w-full min-w-0 bg-transparent tabular-nums outline-none"
          />
        </label>
      </div>
    </div>
  );
}

interface TipOptionProps {
  pressed: boolean;
  onClick: () => void;
  testId: string;
  children: ReactNode;
}

function TipOption({ pressed, onClick, testId, children }: TipOptionProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      data-testid={testId}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-sm font-semibold transition-colors',
        pressed
          ? 'border-primary bg-primary text-on-primary'
          : 'border-outline-variant bg-surface-container-lowest hover:bg-surface-container',
      )}
    >
      {children}
    </button>
  );
}
