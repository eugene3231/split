import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useShareableReceipts } from '@features/share-link/hooks/useShareableReceipts';
import { makeItem, makePerson, makeReceipt, resetAllStores, seedStore } from './testHelpers';

beforeEach(resetAllStores);

describe('Shareable receipts integration', () => {
  it('falls back to the sample receipt while no receipt has a priced item', () => {
    seedStore([makePerson('Alice')], [makeReceipt({ items: [makeItem({ amountInput: '' })] })]);

    const { result } = renderHook(() => useShareableReceipts());

    expect(result.current.isSample).toBe(true);
  });

  it('offers only workspace receipts that have priced items', () => {
    const lunch = makeReceipt({ id: 'lunch', items: [makeItem({ amountInput: '12.00' })] });
    const empty = makeReceipt({ id: 'empty', items: [makeItem({ amountInput: '' })] });
    seedStore([makePerson('Alice'), makePerson('Bob')], [empty, lunch]);

    const { result } = renderHook(() => useShareableReceipts());

    expect(result.current.isSample).toBe(false);
    expect(result.current.receipts.map((r) => r.id)).toEqual(['lunch']);
    expect(result.current.people).toEqual(['Alice', 'Bob']);
  });
});
