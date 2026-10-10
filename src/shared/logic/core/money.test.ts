import { describe, expect, it } from 'vitest';
import { CURRENCY_SYMBOLS } from '@shared/constants';
import {
  formatCurrencyFromCents,
  formatExchangeRate,
  formatMoneyAmount,
  getCurrencySymbol,
  toNullableNumber,
} from '@shared/logic/core/money';

describe('getCurrencySymbol', () => {
  it('returns the mapped symbol for a known currency', () => {
    expect(getCurrencySymbol('SGD')).toBe('$');
  });

  it('returns the currency code itself for unknown currencies', () => {
    expect(getCurrencySymbol('XYZ')).toBe('XYZ');
    expect(getCurrencySymbol('ZZZ')).toBe('ZZZ');
  });

  it('covers every entry in CURRENCY_SYMBOLS', () => {
    for (const [currency, symbol] of Object.entries(CURRENCY_SYMBOLS)) {
      expect(getCurrencySymbol(currency)).toBe(symbol);
    }
  });
});

describe('formatCurrencyFromCents', () => {
  it('defaults to $ (SGD) when no currency is provided', () => {
    expect(formatCurrencyFromCents(1000)).toBe('$10.00');
  });

  it('formats a known non-USD currency with its symbol', () => {
    expect(formatCurrencyFromCents(100000, 'THB')).toBe('฿1,000.00');
  });

  it('formats zero correctly', () => {
    expect(formatCurrencyFromCents(0, 'USD')).toBe('US$0.00');
  });

  it('groups thousands', () => {
    expect(formatCurrencyFromCents(123450, 'SGD')).toBe('$1,234.50');
  });

  it('writes rupiah in whole units, rounding away fractions of a rupiah', () => {
    expect(formatCurrencyFromCents(13500000, 'IDR')).toBe('Rp135,000');
    expect(formatCurrencyFromCents(736749, 'IDR')).toBe('Rp7,367');
  });

  it('drops minor units for currencies that have none, such as yen', () => {
    expect(formatCurrencyFromCents(120000, 'JPY')).toBe('¥1,200');
  });

  it('shows two decimal places for currencies with cents', () => {
    expect(formatCurrencyFromCents(100, 'SGD')).toBe('$1.00');
    expect(formatCurrencyFromCents(150, 'USD')).toBe('US$1.50');
  });

  it('uses the currency code as symbol for unknown currencies', () => {
    expect(formatCurrencyFromCents(500, 'XYZ')).toBe('XYZ5.00');
  });
});

describe('formatMoneyAmount', () => {
  it('formats the amount without a symbol', () => {
    expect(formatMoneyAmount(22660, 'SGD')).toBe('226.60');
    expect(formatMoneyAmount(120642500, 'IDR')).toBe('1,206,425');
  });
});

describe('formatExchangeRate', () => {
  it('groups large rates and keeps five significant digits on small ones', () => {
    expect(formatExchangeRate(12650)).toBe('12,650');
    expect(formatExchangeRate(1 / 12650)).toBe('0.000079051');
    expect(formatExchangeRate(1.298701)).toBe('1.2987');
  });
});

describe('toNullableNumber', () => {
  it('returns number for valid numeric string', () => {
    expect(toNullableNumber('42')).toBe(42);
  });

  it('returns number for comma-separated number string', () => {
    expect(toNullableNumber('1,234.56')).toBe(1234.56);
  });

  it('returns null for empty string', () => {
    expect(toNullableNumber('')).toBeNull();
  });

  it('returns null for non-numeric string', () => {
    expect(toNullableNumber('abc')).toBeNull();
  });

  it('returns number for actual number input', () => {
    expect(toNullableNumber(42)).toBe(42);
  });

  it('returns null for NaN', () => {
    expect(toNullableNumber(NaN)).toBeNull();
  });

  it('returns null for Infinity', () => {
    expect(toNullableNumber(Infinity)).toBeNull();
  });
});
