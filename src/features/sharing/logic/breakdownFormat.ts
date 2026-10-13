import { formatCurrencyFromCents, formatExchangeRate } from '@shared/logic/core/money';
import type { BreakdownConversion, BreakdownExchangeRate } from '@shared/types/summaryBreakdown';

/** The `≈ SGD` amount, then the rate unless the breakdown says it is already shown above. */
export function formatConversionLines(conversion: BreakdownConversion): string[] {
  const amount = `≈ ${formatCurrencyFromCents(conversion.amountCents, conversion.toCurrency)}`;
  return conversion.showRate ? [amount, formatRateLine(conversion)] : [amount];
}

export function formatRateLine(rate: BreakdownExchangeRate): string {
  return `1 ${rate.toCurrency} = ${formatExchangeRate(1 / rate.rate)} ${rate.fromCurrency}`;
}
