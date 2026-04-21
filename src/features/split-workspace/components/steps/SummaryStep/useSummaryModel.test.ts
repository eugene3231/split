import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSummaryModel } from './useSummaryModel';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import {
  makeItem,
  makePerson,
  makeReceipt,
  resetAllStores,
  seedStore,
} from '../../../../../tests/integration/testHelpers';

beforeEach(resetAllStores);

describe('useSummaryModel', () => {
  it('uses activeTab as the summary receipt source when it differs from activeReceiptId', () => {
    const alice = makePerson('Alice');
    const bob = makePerson('Bob');
    const receipt1 = makeReceipt({
      id: 'r1',
      name: 'Receipt 1',
      items: [
        makeItem({
          amountInput: '10.00',
          assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
        }),
      ],
      discount: {
        enabled: true,
        mode: 'percent',
        amountInput: '',
        percentInput: '5',
        detectedConfidence: null,
        detectedSource: null,
      },
    });
    const receipt2 = makeReceipt({
      id: 'r2',
      name: 'Receipt 2',
      items: [
        makeItem({
          amountInput: '20.00',
          assignment: { mode: 'single', personId: bob.id, personIds: [bob.id] },
        }),
      ],
      discount: {
        enabled: true,
        mode: 'amount',
        amountInput: '1.00',
        percentInput: '',
        detectedConfidence: null,
        detectedSource: null,
      },
    });

    seedStore([alice, bob], [receipt1, receipt2], { activeReceiptId: 'r1' });

    const { result } = renderHook(() =>
      useSummaryModel({
        activeTab: 'r2',
        showBaseCurrency: false,
      }),
    );

    expect(useReceiptStore.getState().activeReceiptId).toBe('r1');
    expect(result.current.activeSummaryReceipt?.id).toBe('r2');
    expect(result.current.view.kind).toBe('receipt');
    if (result.current.view.kind !== 'receipt') return;
    expect(result.current.view.receipt?.id).toBe('r2');
    expect(result.current.view.discount).toBe(receipt2.discount);
  });
});
