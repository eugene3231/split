import { describe, expect, it } from 'vitest';
import { formatCurrencyFromCents, getCurrencySymbol } from '@shared/logic/core/money';

describe('getCurrencySymbol', () => {
  it('returns $ for SGD', () => {
    expect(getCurrencySymbol('SGD')).toBe('$');
  });

  it('returns correct symbols for supported currencies', () => {
    expect(getCurrencySymbol('USD')).toBe('US$');
    expect(getCurrencySymbol('EUR')).toBe('€');
    expect(getCurrencySymbol('GBP')).toBe('£');
    expect(getCurrencySymbol('THB')).toBe('฿');
    expect(getCurrencySymbol('MYR')).toBe('RM');
    expect(getCurrencySymbol('JPY')).toBe('¥');
    expect(getCurrencySymbol('KRW')).toBe('₩');
    expect(getCurrencySymbol('IDR')).toBe('Rp');
    expect(getCurrencySymbol('PHP')).toBe('₱');
    expect(getCurrencySymbol('AUD')).toBe('A$');
    expect(getCurrencySymbol('HKD')).toBe('HK$');
    expect(getCurrencySymbol('TWD')).toBe('NT$');
    expect(getCurrencySymbol('VND')).toBe('₫');
    expect(getCurrencySymbol('INR')).toBe('₹');
  });

  it('returns the currency code itself for unknown currencies', () => {
    expect(getCurrencySymbol('XYZ')).toBe('XYZ');
    expect(getCurrencySymbol('ZZZ')).toBe('ZZZ');
  });
});

describe('formatCurrencyFromCents — currency-aware', () => {
  it('defaults to $ (SGD) when no currency is provided', () => {
    expect(formatCurrencyFromCents(1000)).toBe('$10.00');
  });

  it('uses $ for explicit SGD', () => {
    expect(formatCurrencyFromCents(1000, 'SGD')).toBe('$10.00');
  });

  it('formats USD correctly', () => {
    expect(formatCurrencyFromCents(1000, 'USD')).toBe('US$10.00');
  });

  it('formats THB correctly', () => {
    expect(formatCurrencyFromCents(100000, 'THB')).toBe('฿1000.00');
  });

  it('formats JPY correctly', () => {
    expect(formatCurrencyFromCents(100000, 'JPY')).toBe('¥1000.00');
  });

  it('formats zero correctly', () => {
    expect(formatCurrencyFromCents(0, 'USD')).toBe('US$0.00');
  });

  it('always shows two decimal places', () => {
    expect(formatCurrencyFromCents(100, 'SGD')).toBe('$1.00');
    expect(formatCurrencyFromCents(150, 'USD')).toBe('US$1.50');
  });
});
