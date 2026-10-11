import { BASE_CURRENCY } from '@shared/constants';

interface Props {
  currencies: string[];
}

export function MixedCurrencyNote({ currencies }: Props) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-on-surface-variant">
      <span aria-hidden="true" className="material-symbols-outlined text-sm">
        info
      </span>
      Totals in {BASE_CURRENCY}, as receipts are in{' '}
      {new Intl.ListFormat('en', { type: 'conjunction' }).format(currencies)}
    </p>
  );
}
