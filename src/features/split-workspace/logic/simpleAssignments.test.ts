import { describe, expect, it } from 'vitest';
import type { Person } from '@shared/types';
import { buildInitialItems, createDefaultItem } from './simpleAssignments';

const people: Person[] = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
];

describe('buildInitialItems', () => {
  it('returns a single empty item when items is empty', () => {
    const result = buildInitialItems([], people);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('');
    expect(result[0].amountInput).toBe('');
    expect(result[0].assignment.personIds).toEqual(['p1', 'p2']);
  });

  it('returns a single empty item with empty personIds when no people exist', () => {
    const result = buildInitialItems([], []);
    expect(result).toHaveLength(1);
    expect(result[0].assignment.personIds).toEqual([]);
  });

  it('syncs existing items with people when items are present', () => {
    const item = {
      id: 'i1',
      name: 'Laksa',
      amountInput: '5.00',
      discountPercentInput: '',
      assignment: {
        mode: 'single' as const,
        personId: 'p1',
        personIds: ['p1'],
      },
    };

    const result = buildInitialItems([item], people);
    expect(result).toHaveLength(1);
    expect(result[0].assignment.mode).toBe('equal');
    expect(result[0].assignment.personIds).toEqual(['p1', 'p2']);
  });
});

describe('createDefaultItem', () => {
  it('creates an item assigned to all people in equal mode', () => {
    const item = createDefaultItem(people);
    expect(item.assignment.mode).toBe('equal');
    expect(item.assignment.personIds).toEqual(['p1', 'p2']);
    expect(item.name).toBe('');
    expect(item.amountInput).toBe('');
  });

  it('creates an item with empty personIds when no people exist', () => {
    const item = createDefaultItem([]);
    expect(item.assignment.personIds).toEqual([]);
  });
});
