import { formatCurrencyFromCents, formatExchangeRate } from '@shared/logic/core/money';
import type {
  BreakdownChargeRow,
  BreakdownConversion,
  BreakdownExchangeRate,
  BreakdownItemRow,
} from '@shared/types/summaryBreakdown';

// The wording both renderers of a person's card print, so the screen and the image agree on it.

export function formatItemAmount(row: BreakdownItemRow): string {
  return row.amountCents !== null ? formatCurrencyFromCents(row.amountCents, row.currency) : '—';
}

export function formatChargeAmount(row: BreakdownChargeRow): string {
  const sign = row.sign === 'minus' ? '−' : '+';
  return `${sign}${formatCurrencyFromCents(row.amountCents, row.currency)}`;
}

export function formatConversionAmount(conversion: BreakdownConversion): string {
  return `≈ ${formatCurrencyFromCents(conversion.amountCents, conversion.toCurrency)}`;
}

/** The `≈ SGD` amount, then the rate unless the breakdown says it is already shown above. */
export function formatConversionLines(conversion: BreakdownConversion): string[] {
  const amount = formatConversionAmount(conversion);
  return conversion.showRate ? [amount, formatRateLine(conversion)] : [amount];
}

export function formatRateLine(rate: BreakdownExchangeRate): string {
  return `1 ${rate.toCurrency} = ${formatExchangeRate(1 / rate.rate)} ${rate.fromCurrency}`;
}
