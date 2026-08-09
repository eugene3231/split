import { describe, expect, it } from 'vitest';
import type { Person } from '@shared/types';
import {
  buildInitialItems,
  createDefaultItem,
  normalizeItemAssignments,
} from './simpleAssignments';

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

describe('normalizeItemAssignments', () => {
  it('filters removed person out of equal-mode personIds', () => {
    const items = [
      {
        id: 'i1',
        name: 'Shared',
        amountInput: '10.00',
        discountPercentInput: '',
        assignment: { mode: 'equal' as const, personId: '', personIds: ['p1', 'p2'] },
      },
    ];
    const result = normalizeItemAssignments(items, [{ id: 'p1', name: 'Alice' }]);
    expect(result[0].assignment.personIds).toEqual(['p1']);
  });

  it('coerces single-mode item personIds to all current people', () => {
    const items = [
      {
        id: 'i1',
        name: 'Solo',
        amountInput: '5.00',
        discountPercentInput: '',
        assignment: { mode: 'single' as const, personId: 'p1', personIds: ['p1'] },
      },
    ];
    const result = normalizeItemAssignments(items, people);
    expect(result[0].assignment.mode).toBe('equal');
    expect(result[0].assignment.personIds).toEqual(['p1', 'p2']);
  });

  it('clears weights when only 1 person remains after normalization', () => {
    const items = [
      {
        id: 'i1',
        name: 'Weighted',
        amountInput: '30.00',
        discountPercentInput: '',
        assignment: {
          mode: 'equal' as const,
          personId: '',
          personIds: ['p1', 'p2'],
          weights: { p1: 2, p2: 1 },
        },
      },
    ];
    const result = normalizeItemAssignments(items, [{ id: 'p1', name: 'Alice' }]);
    expect(result[0].assignment.personIds).toEqual(['p1']);
    expect(result[0].assignment.weights).toBeUndefined();
  });

  it('preserves weights for surviving people when 2+ people remain', () => {
    const items = [
      {
        id: 'i1',
        name: 'Weighted',
        amountInput: '30.00',
        discountPercentInput: '',
        assignment: {
          mode: 'equal' as const,
          personId: '',
          personIds: ['p1', 'p2', 'p3'],
          weights: { p1: 3, p2: 2, p3: 1 },
        },
      },
    ];
    const result = normalizeItemAssignments(items, people);
    expect(result[0].assignment.personIds).toEqual(['p1', 'p2']);
    expect(result[0].assignment.weights).toEqual({ p1: 3, p2: 2 });
  });

  it('returns undefined weights when all weighted people are removed', () => {
    const items = [
      {
        id: 'i1',
        name: 'Gone',
        amountInput: '10.00',
        discountPercentInput: '',
        assignment: {
          mode: 'equal' as const,
          personId: '',
          personIds: ['p2'],
          weights: { p2: 3 },
        },
      },
    ];
    const result = normalizeItemAssignments(items, [{ id: 'p1', name: 'Alice' }]);
    expect(result[0].assignment.weights).toBeUndefined();
  });

  it('drops weightsInputMode exactly when weights is dropped', () => {
    const survivingItem = {
      id: 'i1',
      name: 'Percent',
      amountInput: '10.00',
      discountPercentInput: '',
      assignment: {
        mode: 'equal' as const,
        personId: '',
        personIds: ['p1', 'p2'],
        weights: { p1: 60, p2: 40 },
        weightsInputMode: 'percent' as const,
      },
    };
    const droppedItem = {
      id: 'i2',
      name: 'Amount',
      amountInput: '10.00',
      discountPercentInput: '',
      assignment: {
        mode: 'equal' as const,
        personId: '',
        personIds: ['p1', 'p2'],
        weights: { p1: 700, p2: 300 },
        weightsInputMode: 'amount' as const,
      },
    };

    const survivingResult = normalizeItemAssignments([survivingItem], people);
    expect(survivingResult[0].assignment.weights).toEqual({ p1: 60, p2: 40 });
    expect(survivingResult[0].assignment.weightsInputMode).toBe('percent');

    const droppedResult = normalizeItemAssignments([droppedItem], [{ id: 'p1', name: 'Alice' }]);
    expect(droppedResult[0].assignment.weights).toBeUndefined();
    expect(droppedResult[0].assignment.weightsInputMode).toBeUndefined();
  });

  it('passes through undefined when item has no weights', () => {
    const items = [
      {
        id: 'i1',
        name: 'Equal',
        amountInput: '10.00',
        discountPercentInput: '',
        assignment: { mode: 'equal' as const, personId: '', personIds: ['p1', 'p2'] },
      },
    ];
    const result = normalizeItemAssignments(items, people);
    expect(result[0].assignment.weights).toBeUndefined();
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
