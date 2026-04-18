import { describe, expect, it } from 'vitest';
import { CURRENCY_SYMBOLS } from '@shared/constants';
import {
  formatCurrencyFromCents,
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
    expect(formatCurrencyFromCents(100000, 'THB')).toBe('฿1000.00');
  });

  it('formats zero correctly', () => {
    expect(formatCurrencyFromCents(0, 'USD')).toBe('US$0.00');
  });

  it('always shows two decimal places', () => {
    expect(formatCurrencyFromCents(100, 'SGD')).toBe('$1.00');
    expect(formatCurrencyFromCents(150, 'USD')).toBe('US$1.50');
  });

  it('uses the currency code as symbol for unknown currencies', () => {
    expect(formatCurrencyFromCents(500, 'XYZ')).toBe('XYZ5.00');
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
