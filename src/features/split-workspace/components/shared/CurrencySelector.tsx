import { CURRENCY_CODES, isCurrencyCode, type CurrencyCode } from '@shared/constants';
import { getCurrencySymbol } from '@shared/logic/core/money';
import { cn } from '@shared/utils/cn';

interface Props {
  value: CurrencyCode;
  onChange: (currency: CurrencyCode) => void;
  className?: string;
}

export function CurrencySelector({ value, onChange, className }: Props) {
  return (
    <div className={cn('relative inline-flex items-center field', className)}>
      <select
        aria-label="Receipt currency"
        value={value}
        onChange={(e) => {
          if (isCurrencyCode(e.target.value)) onChange(e.target.value);
        }}
        className="h-9 cursor-pointer appearance-none bg-transparent py-1 pr-8 pl-3 text-sm font-semibold text-on-surface outline-none"
      >
        {CURRENCY_CODES.map((code) => (
          <option key={code} value={code}>
            {code} {getCurrencySymbol(code)}
          </option>
        ))}
      </select>
      <span
        aria-hidden="true"
        className="material-symbols-outlined pointer-events-none absolute right-2 text-lg text-on-surface-variant"
      >
        expand_more
      </span>
    </div>
  );
}
