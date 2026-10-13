import { describe, expect, it } from 'vitest';
import { formatConversionLines } from '@features/sharing/logic/breakdownFormat';
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
