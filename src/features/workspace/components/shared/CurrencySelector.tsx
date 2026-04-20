import { CURRENCY_SYMBOLS } from '@shared/constants';
import { SUPPORTED_CURRENCIES } from '@features/workspace/constants';

interface Props {
  value: string;
  onChange: (currency: string) => void;
  className?: string;
}

export function CurrencySelector({ value, onChange, className }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`cursor-pointer rounded-lg border border-outline-variant/40 bg-surface-container px-2 py-1 text-sm font-semibold text-on-surface focus:ring-2 focus:ring-primary/40 focus:outline-none ${className ?? ''}`}
    >
      {SUPPORTED_CURRENCIES.map((code) => (
        <option key={code} value={code}>
          {code} {CURRENCY_SYMBOLS[code]}
        </option>
      ))}
    </select>
  );
}
