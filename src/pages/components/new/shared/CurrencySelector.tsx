import { SUPPORTED_CURRENCIES, CURRENCY_SYMBOLS } from '@shared/constants'

interface Props {
  value: string
  onChange: (currency: string) => void
  className?: string
}

export function CurrencySelector({ value, onChange, className }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-surface-container border border-outline-variant/40 rounded-lg px-2 py-1 text-sm font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer ${className ?? ''}`}
    >
      {SUPPORTED_CURRENCIES.map((code) => (
        <option key={code} value={code}>
          {code} {CURRENCY_SYMBOLS[code]}
        </option>
      ))}
    </select>
  )
}
