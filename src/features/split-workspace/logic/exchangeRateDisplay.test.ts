import { describe, expect, it } from 'vitest';
import { computeReverseRate, parseRateInput } from './exchangeRateDisplay';

describe('computeReverseRate', () => {
  it('returns 1/rate for positive rates', () => {
    expect(computeReverseRate(2)).toBeCloseTo(0.5);
  });

  it('returns 0 for zero rate', () => {
    expect(computeReverseRate(0)).toBe(0);
  });
});

describe('parseRateInput', () => {
  it('parses forward rate input directly', () => {
    expect(parseRateInput('1.35', 'forward')).toBeCloseTo(1.35);
  });

  it('converts reverse rate input to forward rate', () => {
    expect(parseRateInput('0.5', 'reverse')).toBeCloseTo(2);
  });

  it('returns null for non-numeric input', () => {
    expect(parseRateInput('abc', 'forward')).toBeNull();
  });

  it('returns null for zero or negative input', () => {
    expect(parseRateInput('0', 'forward')).toBeNull();
    expect(parseRateInput('-1.5', 'forward')).toBeNull();
  });

  it('treats null editingField as forward and returns the parsed value', () => {
    expect(parseRateInput('1.35', null)).toBeCloseTo(1.35);
  });
});
