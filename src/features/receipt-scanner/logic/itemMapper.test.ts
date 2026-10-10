import { describe, expect, it } from 'vitest';
import { createItemFromOcr } from './itemMapper';

describe('createItemFromOcr', () => {
  it('creates an unclaimed item from a scanned line', () => {
    const item = createItemFromOcr({ description: 'Laksa', amount: 8.5 });

    expect(item.name).toBe('Laksa');
    expect(item.amountInput).toBe('8.50');
    expect(item.discountPercentInput).toBe('');
    expect(item.assignment).toEqual({ mode: 'equal', personId: '', personIds: [] });
  });
});
