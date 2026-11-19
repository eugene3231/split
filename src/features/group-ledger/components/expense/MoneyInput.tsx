import type { ComponentProps } from 'react';
import type { CurrencyCode } from '@shared/constants';
import { getCurrencySymbol } from '@shared/logic/core/money';
import { cn } from '@shared/utils/cn';

interface MoneyInputProps extends Omit<ComponentProps<'input'>, 'onChange'> {
  currency: CurrencyCode;
  onValueChange: (value: string) => void;
}

/** A small amount field with the currency's symbol in front, for one person's share. */
export function MoneyInput({ currency, onValueChange, className, ...props }: MoneyInputProps) {
  return (
    <label className={cn('flex h-11 w-32 shrink-0 items-center gap-1 field px-3', className)}>
      <span aria-hidden="true" className="text-sm text-on-surface-variant">
        {getCurrencySymbol(currency)}
      </span>
      <input
        type="text"
        inputMode="decimal"
        placeholder="0.00"
        onChange={(event) => onValueChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-right text-base tabular-nums outline-none placeholder:text-outline"
        {...props}
      />
    </label>
  );
}
