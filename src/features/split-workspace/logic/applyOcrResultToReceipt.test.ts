import { describe, expect, it } from 'vitest';
import type { OcrResponse, Person, Receipt } from '@shared/types';
import {
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '@features/split-workspace/constants';
import { buildReceiptOcrPatch } from './applyOcrResultToReceipt';

const people: Person[] = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
];

function makeReceipt(): Receipt {
  return {
    id: 'r1',
    name: 'Dinner',
    items: [
      {
        id: 'i-existing',
        name: 'Existing item',
        amountInput: '5.00',
        discountPercentInput: '',
        assignment: {
          mode: 'equal',
          personId: '',
          personIds: ['p1', 'p2'],
        },
      },
    ],
    discount: { ...defaultDiscountState },
    serviceCharge: { ...defaultServiceChargeState },
    gst: { ...defaultGstState },
    receiptTotalInput: '5.00',
    currency: 'SGD',
    exchangeRateOverride: null,
  };
}

describe('buildReceiptOcrPatch', () => {
  it('maps OCR items into workspace items and applies detected charges and total', () => {
    const receipt = makeReceipt();
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

    const patch = buildReceiptOcrPatch(receipt, payload, people);

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

  it('preserves existing items and receipt total when OCR omits them', () => {
    const receipt = makeReceipt();
    const payload: OcrResponse = {
      items: [],
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

    const patch = buildReceiptOcrPatch(receipt, payload, people);

    expect(patch.items).toBe(receipt.items);
    expect(patch.receiptTotalInput).toBe('5.00');
    expect(patch.serviceCharge.detectedSource).toBeNull();
    expect(patch.gst.detectedSource).toBeNull();
  });
});
