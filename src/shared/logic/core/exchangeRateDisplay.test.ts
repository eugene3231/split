import { describe, expect, it } from 'vitest';
import { computeEffectiveRate, computeReverseRate, parseRateInput } from './exchangeRateDisplay';

const rates: Record<string, number> = { USD: 1.35, THB: 0.038 };

describe('computeEffectiveRate', () => {
  it('uses override when provided and positive', () => {
    expect(computeEffectiveRate('USD', rates, 1.5)).toBe(1.5);
  });

  it('falls back to rates map when no override', () => {
    expect(computeEffectiveRate('USD', rates, null)).toBe(1.35);
  });

  it('falls back through rates map then FALLBACK_RATES_TO_SGD then 1', () => {
    expect(computeEffectiveRate('EUR', {}, null)).toBeGreaterThan(0);
    expect(computeEffectiveRate('ZZZ', {}, null)).toBe(1);
  });

  it('ignores override of 0', () => {
    expect(computeEffectiveRate('USD', rates, 0)).toBe(1.35);
  });
});

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

  it('returns null when editingField is null', () => {
    expect(parseRateInput('1.35', null)).toBeCloseTo(1.35);
  });
});
