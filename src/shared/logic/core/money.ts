export function toNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().replace(/,/g, '');
    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
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

import { CURRENCY_SYMBOLS } from '@shared/constants';

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

// Currencies that are written without minor units even where ISO 4217 lists some, such as
// rupiah prices on Indonesian receipts. Intl already drops them for JPY, KRW, VND and similar.
const WHOLE_UNIT_CURRENCIES = new Set(['IDR']);

function fractionDigitsFor(currency: string): number {
  if (WHOLE_UNIT_CURRENCIES.has(currency)) return 0;
  try {
    return (
      new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/** The amount without its symbol, grouped and rounded the way the currency is usually written. */
export function formatMoneyAmount(cents: number, currency = 'SGD'): string {
  const digits = fractionDigitsFor(currency);
  return new Intl.NumberFormat('en', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(cents / 100);
}

export function formatCurrencyFromCents(cents: number, currency = 'SGD'): string {
  return `${getCurrencySymbol(currency)}${formatMoneyAmount(cents, currency)}`;
}

/** An exchange rate to five significant digits, grouped: 12,650 or 0.000079051. */
export function formatExchangeRate(rate: number): string {
  return new Intl.NumberFormat('en', { maximumSignificantDigits: 5 }).format(rate);
}
