import { describe, expect, it } from 'vitest';
import type { ChargeState } from '@shared/types';
import {
  applyChargeDetection,
  resolveChargeCents,
  resolveReceiptCharges,
} from '@features/split-workspace/logic/split/charges';
import { defaultTipState } from '@features/split-workspace/constants';

const baseChargeState: ChargeState = {
  enabled: true,
  mode: 'percent',
  amountInput: '',
  percentInput: '10',
  detectedConfidence: null,
  detectedSource: null,
};

describe('resolveChargeCents', () => {
  it('returns 0 when charge is disabled', () => {
    expect(resolveChargeCents({ ...baseChargeState, enabled: false }, 1000)).toBe(0);
  });

  it('resolves amount mode from amount input', () => {
    expect(
      resolveChargeCents(
        {
          ...baseChargeState,
          mode: 'amount',
          amountInput: '2.35',
        },
        1000,
      ),
    ).toBe(235);
  });

  it('returns 0 when percent input is empty or unparseable', () => {
    expect(
      resolveChargeCents({ ...baseChargeState, mode: 'percent', percentInput: '' }, 1000),
    ).toBe(0);
    expect(
      resolveChargeCents({ ...baseChargeState, mode: 'percent', percentInput: 'abc' }, 1000),
    ).toBe(0);
  });

  it('uses the explicit percentage base including zero', () => {
    expect(
      resolveChargeCents(
        {
          ...baseChargeState,
          mode: 'percent',
          percentInput: '10',
        },
        500,
      ),
    ).toBe(50);

    expect(
      resolveChargeCents(
        {
          ...baseChargeState,
          mode: 'percent',
          percentInput: '10',
        },
        0,
      ),
    ).toBe(0);
  });
});

describe('applyChargeDetection', () => {
  it('applies detected amount and metadata', () => {
    const next = applyChargeDetection(baseChargeState, {
      enabled: true,
      amount: 1.2,
      percent: null,
      confidence: 0.91,
      source: 'ocr',
    });

    expect(next.enabled).toBe(true);
    expect(next.mode).toBe('amount');
    expect(next.amountInput).toBe('1.20');
    expect(next.detectedConfidence).toBe(0.91);
    expect(next.detectedSource).toBe('ocr');
  });

  it('applies detected percent and maps source none to null', () => {
    const next = applyChargeDetection(baseChargeState, {
      enabled: false,
      amount: null,
      percent: 9,
      confidence: null,
      source: 'none',
    });

    expect(next.enabled).toBe(false);
    expect(next.mode).toBe('percent');
    expect(next.percentInput).toBe('9');
    expect(next.detectedSource).toBeNull();
  });

  it('resolves amount mode with unparseable amountInput as 0', () => {
    expect(
      resolveChargeCents(
        {
          ...baseChargeState,
          mode: 'amount',
          amountInput: 'not a number',
        },
        1000,
      ),
    ).toBe(0);
  });

  it('applies charge detection with amount 9.5 to set amount mode', () => {
    const next = applyChargeDetection(baseChargeState, {
      enabled: true,
      amount: 9.5,
      percent: null,
      confidence: 0.8,
      source: 'ocr',
    });

    expect(next.mode).toBe('amount');
    expect(next.amountInput).toBe('9.50');
    expect(next.detectedConfidence).toBe(0.8);
  });

  it('applies detection with both amount and percent null — keeps existing mode and inputs', () => {
    const next = applyChargeDetection(baseChargeState, {
      enabled: true,
      amount: null,
      percent: null,
      confidence: null,
      source: 'ocr',
    });

    expect(next.enabled).toBe(true);
    expect(next.mode).toBe('percent');
    expect(next.percentInput).toBe('10');
    expect(next.amountInput).toBe('');
    expect(next.detectedSource).toBe('ocr');
  });
});

describe('receipt charge bases', () => {
  it('keeps a zero GST base when a fixed service adjustment cancels the subtotal', () => {
    expect(
      resolveReceiptCharges({
        subtotalCents: 1000,
        discount: { ...baseChargeState, enabled: false },
        serviceCharge: { ...baseChargeState, mode: 'amount', amountInput: '-10.00' },
        gst: baseChargeState,
        tip: defaultTipState,
      }).gstCents,
    ).toBe(0);
  });
  it('resolves fixed charges even with a zero base', () => {
    expect(resolveChargeCents({ ...baseChargeState, mode: 'amount', amountInput: '2.35' }, 0)).toBe(
      235,
    );
  });
});

describe('tip', () => {
  const noCharge = { ...baseChargeState, enabled: false };

  it('takes a tip percent of the food after discount and charges no GST on it', () => {
    const charges = resolveReceiptCharges({
      subtotalCents: 10000,
      discount: { ...baseChargeState, mode: 'amount', amountInput: '20.00' },
      serviceCharge: baseChargeState,
      gst: { ...baseChargeState, percentInput: '9' },
      tip: { ...baseChargeState, percentInput: '15' },
    });

    expect(charges.tipCents).toBe(1200);
    expect(charges.gstCents).toBe(792);
    expect(charges.billTotalCents).toBe(8000 + 800 + 792);
    expect(charges.grandTotalCents).toBe(charges.billTotalCents + 1200);
  });

  it('takes a typed tip amount as is and ignores a negative one', () => {
    const base = {
      subtotalCents: 5000,
      discount: noCharge,
      serviceCharge: noCharge,
      gst: noCharge,
    };

    expect(
      resolveReceiptCharges({
        ...base,
        tip: { ...baseChargeState, mode: 'amount', amountInput: '7.50' },
      }).tipCents,
    ).toBe(750);
    expect(
      resolveReceiptCharges({
        ...base,
        tip: { ...baseChargeState, mode: 'amount', amountInput: '-3' },
      }).tipCents,
    ).toBe(0);
    expect(resolveReceiptCharges({ ...base, tip: defaultTipState }).tipCents).toBe(0);
  });
});
