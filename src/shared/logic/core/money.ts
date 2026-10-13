import { BASE_CURRENCY, currencyInfo, type CurrencyCode } from '@shared/constants';

export function toNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return typeof value === 'string' ? parseNumber(value) : null;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parseNumber(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(/,/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseCurrencyToCents(input: string): number | null {
  const parsed = parseNumber(input);
  if (parsed === null) {
    return null;
  }

  return Math.round(parsed * 100);
}

export function getCurrencySymbol(currency: CurrencyCode): string {
  return currencyInfo(currency).symbol;
}

function fractionDigitsFor(currency: CurrencyCode): number {
  if (currencyInfo(currency).wholeUnits) return 0;
  return (
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  );
}

/** The amount without its symbol, grouped and rounded the way the currency is usually written. */
export function formatMoneyAmount(cents: number, currency: CurrencyCode): string {
  const digits = fractionDigitsFor(currency);
  return new Intl.NumberFormat('en', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(cents / 100);
}

/**
 * A typed amount regrouped the way the currency is written, keeping up to two decimals that were
 * typed: 71,750 for rupiah, 12.50 for dollars. Text that isn't a number comes back unchanged.
 */
export function formatMoneyInput(input: string, currency: CurrencyCode): string {
  const parsed = parseNumber(input);
  if (parsed === null) return input;
  const digits = fractionDigitsFor(currency);
  return new Intl.NumberFormat('en', {
    minimumFractionDigits: digits,
    maximumFractionDigits: Math.max(digits, 2),
  }).format(parsed);
}

/** A typed percent to at most two decimals, without trailing zeros: 9 or 10.5. */
export function formatPercentInput(input: string): string {
  const parsed = parseNumber(input);
  if (parsed === null) return input;
  return new Intl.NumberFormat('en', { maximumFractionDigits: 2, useGrouping: false }).format(
    parsed,
  );
}

export function formatCurrencyFromCents(
  cents: number,
  currency: CurrencyCode = BASE_CURRENCY,
): string {
  return `${getCurrencySymbol(currency)}${formatMoneyAmount(cents, currency)}`;
}

/** An exchange rate to five significant digits, grouped: 12,650 or 0.000079051. */
export function formatExchangeRate(rate: number): string {
  return new Intl.NumberFormat('en', { maximumSignificantDigits: 5 }).format(rate);
}
