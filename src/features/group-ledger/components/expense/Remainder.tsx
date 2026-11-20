import type { CurrencyCode } from '@shared/constants';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { cn } from '@shared/utils/cn';

interface RemainderProps {
  cents: number;
  currency: CurrencyCode;
  short: string;
}

export function Remainder({ cents, currency, short }: RemainderProps) {
  const amount = formatCurrencyFromCents(Math.abs(cents), currency);
  return (
    <p
      aria-live="polite"
      className={cn(
        'px-2 pt-2 pb-1 text-right text-sm font-semibold tabular-nums',
        cents === 0 ? 'text-secondary' : 'text-warning',
      )}
    >
      {cents === 0 ? 'Adds up' : cents > 0 ? `${amount} ${short}` : `${amount} too much`}
    </p>
  );
}
