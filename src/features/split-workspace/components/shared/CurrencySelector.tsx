import { CURRENCY_CODES, isCurrencyCode, type CurrencyCode } from '@shared/constants';
import { getCurrencySymbol } from '@shared/logic/core/money';

interface Props {
  value: CurrencyCode;
  onChange: (currency: CurrencyCode) => void;
  className?: string;
}

export function CurrencySelector({ value, onChange, className }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => {
        if (isCurrencyCode(e.target.value)) onChange(e.target.value);
      }}
      className={`cursor-pointer rounded-lg border border-outline-variant/40 bg-surface-container px-2 py-1 text-sm font-semibold text-on-surface focus:ring-2 focus:ring-primary/40 focus:outline-none ${className ?? ''}`}
    >
      {CURRENCY_CODES.map((code) => (
        <option key={code} value={code}>
          {code} {getCurrencySymbol(code)}
        </option>
      ))}
    </select>
  );
}
