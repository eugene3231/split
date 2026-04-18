import { describe, expect, it } from 'vitest';
import type { ChargeState } from '@shared/types';
import { applyChargeDetection, resolveChargeCents } from '@shared/logic/computation/charges';

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
    expect(resolveChargeCents({ ...baseChargeState, enabled: false }, 1000, 1000)).toBe(0);
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
        1000,
      ),
    ).toBe(235);
  });

  it('returns 0 when percent input is empty or unparseable', () => {
    expect(
      resolveChargeCents({ ...baseChargeState, mode: 'percent', percentInput: '' }, 1000, 1000),
    ).toBe(0);
    expect(
      resolveChargeCents({ ...baseChargeState, mode: 'percent', percentInput: 'abc' }, 1000, 1000),
    ).toBe(0);
  });

  it('uses percentage base when provided, otherwise falls back to subtotal', () => {
    expect(
      resolveChargeCents(
        {
          ...baseChargeState,
          mode: 'percent',
          percentInput: '10',
        },
        1000,
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
        1000,
        0,
      ),
    ).toBe(100);
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
});
