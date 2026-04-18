import { describe, expect, it } from 'vitest';
import { createItemFromOcr } from './itemMapper';

describe('createItemFromOcr', () => {
  it('creates an item assigned to the first person', () => {
    const people = [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' },
    ];

    const item = createItemFromOcr({ description: 'Laksa', amount: 8.5 }, people);

    expect(item.name).toBe('Laksa');
    expect(item.amountInput).toBe('8.50');
    expect(item.discountPercentInput).toBe('');
    expect(item.assignment.mode).toBe('single');
    expect(item.assignment.personId).toBe('p1');
    expect(item.assignment.personIds).toEqual(['p1', 'p2']);
  });

  it('falls back to empty personId when no people exist', () => {
    const item = createItemFromOcr({ description: 'Tea', amount: 2 }, []);

    expect(item.assignment.mode).toBe('single');
    expect(item.assignment.personId).toBe('');
    expect(item.assignment.personIds).toEqual([]);
  });
});
