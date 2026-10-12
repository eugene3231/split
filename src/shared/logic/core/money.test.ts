import { describe, expect, it } from 'vitest';
import { CURRENCIES, CURRENCY_CODES } from '@shared/constants';
import {
  formatCurrencyFromCents,
  formatExchangeRate,
  formatMoneyAmount,
  formatMoneyInput,
  formatPercentInput,
  getCurrencySymbol,
  toNullableNumber,
} from '@shared/logic/core/money';

describe('getCurrencySymbol', () => {
  it('returns the mapped symbol for a known currency', () => {
    expect(getCurrencySymbol('SGD')).toBe('$');
  });

  it('has a symbol for every currency the app supports', () => {
    for (const currency of CURRENCY_CODES) {
      expect(getCurrencySymbol(currency)).toBe(CURRENCIES[currency].symbol);
    }
    expect(CURRENCY_CODES).toHaveLength(16);
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
});

describe('formatMoneyAmount', () => {
  it('formats the amount without a symbol', () => {
    expect(formatMoneyAmount(22660, 'SGD')).toBe('226.60');
    expect(formatMoneyAmount(120642500, 'IDR')).toBe('1,206,425');
  });
});

describe('formatMoneyInput', () => {
  it('groups rupiah without decimals', () => {
    expect(formatMoneyInput('71750.00', 'IDR')).toBe('71,750');
  });

  it('pads dollars to cents and groups thousands', () => {
    expect(formatMoneyInput('1234.5', 'SGD')).toBe('1,234.50');
  });

  it('keeps cents typed into a whole-unit currency', () => {
    expect(formatMoneyInput('71750.5', 'IDR')).toBe('71,750.5');
  });

  it('reads an amount that is already grouped', () => {
    expect(formatMoneyInput('1,206,500', 'IDR')).toBe('1,206,500');
  });

  it('leaves empty and non-numeric input alone', () => {
    expect(formatMoneyInput('', 'SGD')).toBe('');
    expect(formatMoneyInput('abc', 'SGD')).toBe('abc');
  });
});

describe('formatPercentInput', () => {
  it('drops trailing zeros', () => {
    expect(formatPercentInput('9.00')).toBe('9');
    expect(formatPercentInput('10.50')).toBe('10.5');
  });

  it('rounds to two decimals', () => {
    expect(formatPercentInput('8.125')).toBe('8.13');
  });

  it('leaves empty input alone', () => {
    expect(formatPercentInput('')).toBe('');
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
