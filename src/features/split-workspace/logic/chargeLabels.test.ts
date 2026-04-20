import { describe, expect, it } from 'vitest';
import { buildChargeLabel } from '@features/split-workspace/logic/chargeLabels';
import type { ChargeState } from '@shared/types';

const disabledCharge: ChargeState = {
  enabled: false,
  mode: 'percent',
  amountInput: '',
  percentInput: '',
  detectedConfidence: null,
  detectedSource: null,
};

describe('buildChargeLabel', () => {
  it('returns label with (off) when charge is disabled', () => {
    expect(buildChargeLabel('GST', disabledCharge)).toBe('GST (off)');
  });

  it('returns label with percentage when mode is percent and input parses', () => {
    const charge: ChargeState = {
      ...disabledCharge,
      enabled: true,
      mode: 'percent',
      percentInput: '10',
    };
    expect(buildChargeLabel('Service Charge', charge)).toBe('Service Charge (10%)');
  });

  it('strips trailing zeros from percentage', () => {
    const charge: ChargeState = {
      ...disabledCharge,
      enabled: true,
      mode: 'percent',
      percentInput: '9',
    };
    expect(buildChargeLabel('GST', charge)).toBe('GST (9%)');
  });

  it('returns label with (%) when percent input is unparseable', () => {
    const charge: ChargeState = {
      ...disabledCharge,
      enabled: true,
      mode: 'percent',
      percentInput: 'abc',
    };
    expect(buildChargeLabel('GST', charge)).toBe('GST (%)');
  });

  it('returns label with (amount) when mode is amount', () => {
    const charge: ChargeState = {
      ...disabledCharge,
      enabled: true,
      mode: 'amount',
      amountInput: '5.00',
      percentInput: '',
    };
    expect(buildChargeLabel('Service Charge', charge)).toBe('Service Charge (amount)');
  });
});
