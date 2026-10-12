import { describe, expect, it } from 'vitest';
import {
  resolveChargeLabel,
  type ReceiptCharges,
} from '@features/split-workspace/logic/chargeLabels';
import type { ChargeState } from '@shared/types';

const disabledCharge: ChargeState = {
  enabled: false,
  mode: 'percent',
  amountInput: '',
  percentInput: '',
  detectedConfidence: null,
  detectedSource: null,
};

function charges(overrides: Partial<ReceiptCharges> = {}): ReceiptCharges {
  return {
    discount: disabledCharge,
    serviceCharge: disabledCharge,
    gst: disabledCharge,
    ...overrides,
  };
}

describe('resolveChargeLabel', () => {
  it('returns label with (off) when charge is disabled', () => {
    expect(resolveChargeLabel('gst', charges())).toBe('GST / Tax (off)');
  });

  it('returns label with percentage when mode is percent and input parses', () => {
    const serviceCharge: ChargeState = {
      ...disabledCharge,
      enabled: true,
      mode: 'percent',
      percentInput: '10',
    };
    expect(resolveChargeLabel('service', charges({ serviceCharge }))).toBe('Service Charge (10%)');
  });

  it('strips trailing zeros from percentage', () => {
    const gst: ChargeState = {
      ...disabledCharge,
      enabled: true,
      mode: 'percent',
      percentInput: '9.00',
    };
    expect(resolveChargeLabel('gst', charges({ gst }))).toBe('GST / Tax (9%)');
  });

  it('returns label with (%) when percent input is unparseable', () => {
    const discount: ChargeState = {
      ...disabledCharge,
      enabled: true,
      mode: 'percent',
      percentInput: 'abc',
    };
    expect(resolveChargeLabel('discount', charges({ discount }))).toBe('Discount (%)');
  });

  it('returns the bare label for a fixed-amount charge', () => {
    const serviceCharge: ChargeState = {
      ...disabledCharge,
      enabled: true,
      mode: 'amount',
      amountInput: '5.00',
      percentInput: '',
    };
    expect(resolveChargeLabel('service', charges({ serviceCharge }))).toBe('Service Charge');
  });

  it('reads each charge from its own setting', () => {
    const tenPercent: ChargeState = { ...disabledCharge, enabled: true, percentInput: '10' };
    expect(resolveChargeLabel('discount', charges({ gst: tenPercent }))).toBe('Discount (off)');
    expect(resolveChargeLabel('gst', charges({ gst: tenPercent }))).toBe('GST / Tax (10%)');
  });

  it('names rounding without a setting', () => {
    expect(resolveChargeLabel('rounding', charges())).toBe('Rounding');
  });
});
