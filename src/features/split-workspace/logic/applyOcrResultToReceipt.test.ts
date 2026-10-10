import { describe, expect, it } from 'vitest';
import type { OcrResponse, Person } from '@shared/types';
import {
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '@features/split-workspace/constants';
import { buildReceiptOcrReplacement } from './applyOcrResultToReceipt';

const people: Person[] = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
];

describe('buildReceiptOcrReplacement', () => {
  it('maps OCR items into workspace items and applies detected charges and total', () => {
    const payload: OcrResponse = {
      items: [{ description: 'Laksa', amount: 12.5 }],
      subtotal: 12.5,
      total: 13.63,
      detected: {
        serviceCharge: {
          enabled: true,
          amount: null,
          percent: 10,
          confidence: 0.8,
          source: 'gemini',
        },
        gst: {
          enabled: true,
          amount: 1.13,
          percent: null,
          confidence: 0.9,
          source: 'receipt',
        },
      },
      warnings: [],
    };

    const patch = buildReceiptOcrReplacement(payload, people);

    expect(patch.items).toHaveLength(1);
    expect(patch.items[0]).toMatchObject({
      name: 'Laksa',
      amountInput: '12.50',
      assignment: {
        mode: 'equal',
        personId: '',
        personIds: ['p1', 'p2'],
      },
    });
    expect(patch.serviceCharge).toMatchObject({
      enabled: true,
      mode: 'percent',
      percentInput: '10',
      detectedConfidence: 0.8,
      detectedSource: 'gemini',
    });
    expect(patch.gst).toMatchObject({
      enabled: true,
      mode: 'amount',
      amountInput: '1.13',
      detectedConfidence: 0.9,
      detectedSource: 'receipt',
    });
    expect(patch.receiptTotalInput).toBe('13.63');
  });

  it('uses fresh charge defaults and an empty total when extraction omits them', () => {
    const payload: OcrResponse = {
      items: [{ description: 'Laksa', amount: 12.5 }],
      subtotal: null,
      total: null,
      detected: {
        serviceCharge: {
          enabled: false,
          amount: null,
          percent: null,
          confidence: null,
          source: 'none',
        },
        gst: {
          enabled: false,
          amount: null,
          percent: null,
          confidence: null,
          source: 'none',
        },
      },
      warnings: ['No confident line items'],
    };

    const patch = buildReceiptOcrReplacement(payload, people);

    expect(patch.discount).toEqual(defaultDiscountState);
    expect(patch.discount).not.toBe(defaultDiscountState);
    expect(patch.serviceCharge).toEqual({ ...defaultServiceChargeState, enabled: false });
    expect(patch.serviceCharge).not.toBe(defaultServiceChargeState);
    expect(patch.gst).toEqual({ ...defaultGstState, enabled: false });
    expect(patch.gst).not.toBe(defaultGstState);
    expect(patch.receiptTotalInput).toBe('');
    expect(patch.serviceCharge.detectedSource).toBeNull();
    expect(patch.gst.detectedSource).toBeNull();
  });
});
