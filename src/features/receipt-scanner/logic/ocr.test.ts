import { describe, expect, it } from 'vitest';
import type { Dispatch, SetStateAction } from 'react';
import type { ChargeState, EditableItem, OcrResponse, Person } from '@shared/types';
import { applyOcrPayload } from './ocr';

function setStateValue<T>(current: T, next: SetStateAction<T>): T {
  return typeof next === 'function' ? (next as (prev: T) => T)(current) : next;
}

describe('applyOcrPayload', () => {
  it('updates items, charges, warnings, and receipt total', () => {
    const people: Person[] = [{ id: 'p1', name: 'Alice' }];
    const payload: OcrResponse = {
      items: [
        { description: 'Laksa', amount: 12 },
        { description: 'Tea', amount: 2.5 },
      ],
      subtotal: 14.5,
      total: 15.81,
      detected: {
        serviceCharge: {
          enabled: true,
          amount: null,
          percent: 10,
          confidence: 0.9,
          source: 'gemini',
        },
        gst: {
          enabled: true,
          amount: null,
          percent: 9,
          confidence: 0.9,
          source: 'gemini',
        },
      },
      warnings: ['Check subtotal'],
    };

    let items: EditableItem[] = [
      {
        id: 'old',
        name: 'Old',
        amountInput: '1.00',
        discountPercentInput: '',
        assignment: { mode: 'single', personId: 'p1', personIds: ['p1'] },
      },
    ];
    let serviceCharge: ChargeState = {
      enabled: true,
      mode: 'percent',
      amountInput: '',
      percentInput: '10',
      detectedConfidence: null,
      detectedSource: null,
    };
    let gst: ChargeState = {
      enabled: true,
      mode: 'percent',
      amountInput: '',
      percentInput: '9',
      detectedConfidence: null,
      detectedSource: null,
    };
    let scanWarnings: string[] = [];
    let receiptTotalInput = '';

    const setItems: Dispatch<SetStateAction<EditableItem[]>> = (next) => {
      items = setStateValue(items, next);
    };
    const setServiceCharge: Dispatch<SetStateAction<ChargeState>> = (next) => {
      serviceCharge = setStateValue(serviceCharge, next);
    };
    const setGst: Dispatch<SetStateAction<ChargeState>> = (next) => {
      gst = setStateValue(gst, next);
    };
    const setScanWarnings: Dispatch<SetStateAction<string[]>> = (next) => {
      scanWarnings = setStateValue(scanWarnings, next);
    };
    const setReceiptTotalInput: Dispatch<SetStateAction<string>> = (next) => {
      receiptTotalInput = setStateValue(receiptTotalInput, next);
    };

    applyOcrPayload(
      payload,
      people,
      setItems,
      setServiceCharge,
      setGst,
      setScanWarnings,
      setReceiptTotalInput,
    );

    expect(items).toHaveLength(2);
    expect(items[0].name).toBe('Laksa');
    expect(items[0].amountInput).toBe('12.00');
    expect(items[0].assignment.personId).toBe('p1');
    expect(serviceCharge.mode).toBe('percent');
    expect(serviceCharge.percentInput).toBe('10');
    expect(gst.mode).toBe('percent');
    expect(gst.percentInput).toBe('9');
    expect(scanWarnings).toEqual(['Check subtotal']);
    expect(receiptTotalInput).toBe('15.81');
  });
});
