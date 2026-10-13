import { describe, expect, it } from 'vitest';
import {
  formatChargeAmount,
  formatConversionLines,
  formatItemAmount,
} from '@features/sharing/logic/breakdownFormat';
import type { BreakdownConversion } from '@shared/types/summaryBreakdown';

describe('currency conversion copy', () => {
  const conversion: BreakdownConversion = {
    amountCents: 1352,
    rate: 1.35,
    fromCurrency: 'USD',
    toCurrency: 'SGD',
    showRate: true,
  };

  it('renders the allocated SGD cents supplied by the shared breakdown, then the rate', () => {
    expect(formatConversionLines(conversion)).toEqual(['≈ $13.52', '1 SGD = 0.74074 USD']);
  });

  it('leaves the rate out when the breakdown already shows it above', () => {
    expect(formatConversionLines({ ...conversion, showRate: false })).toEqual(['≈ $13.52']);
  });
});

describe('breakdown amounts', () => {
  it('writes a dash for an item the person had no share of', () => {
    const row = { kind: 'item', id: 'tea', label: 'Tea', currency: 'SGD' } as const;
    expect(formatItemAmount({ ...row, amountCents: 350 })).toBe('$3.50');
    expect(formatItemAmount({ ...row, amountCents: null })).toBe('—');
  });

  it('signs a charge by whether it adds to the total or comes off it', () => {
    const row = { kind: 'charge', label: 'x', amountCents: 120, currency: 'SGD' } as const;
    expect(formatChargeAmount({ ...row, charge: 'service', sign: 'plus' })).toBe('+$1.20');
    expect(formatChargeAmount({ ...row, charge: 'discount', sign: 'minus' })).toBe('−$1.20');
  });
});
