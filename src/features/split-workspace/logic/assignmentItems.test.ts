import { describe, expect, it } from 'vitest';
import type { EditableItem, Person } from '@shared/types';
import {
  pickDefaultPersonId,
  sanitizeItemAssignment,
} from '@features/split-workspace/logic/assignmentItems';

const people: Person[] = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
];

function buildItem(overrides: Partial<EditableItem> = {}): EditableItem {
  return {
    id: 'item-1',
    name: 'Noodles',
    amountInput: '10.00',
    discountPercentInput: '',
    assignment: {
      mode: 'single',
      personId: 'p1',
      personIds: ['p1', 'p2'],
    },
    ...overrides,
  };
}

describe('sanitizeItemAssignment', () => {
  it('replaces invalid single assignment with first available person', () => {
    const item = buildItem({
      assignment: {
        mode: 'single',
        personId: 'missing',
        personIds: ['p1', 'p2'],
      },
    });

    const next = sanitizeItemAssignment(item, people);
    expect(next.assignment.personId).toBe('p1');
  });

  it('falls back to empty string for single assignment when people list is empty', () => {
    const item = buildItem({
      assignment: {
        mode: 'single',
        personId: 'missing',
        personIds: ['p1', 'p2'],
      },
    });

    const next = sanitizeItemAssignment(item, []);
    expect(next.assignment.personId).toBe('');
  });

  it('keeps valid single assignment unchanged', () => {
    const item = buildItem({
      assignment: {
        mode: 'single',
        personId: 'p2',
        personIds: ['p1', 'p2'],
      },
    });

    const next = sanitizeItemAssignment(item, people);
    expect(next).toBe(item);
  });

  it('filters invalid and duplicate equal-split ids without changing valid ids', () => {
    const item = buildItem({
      assignment: {
        mode: 'equal',
        personId: 'p1',
        personIds: ['p2', 'missing', 'p2', 'p1'],
      },
    });

    const next = sanitizeItemAssignment(item, people);
    expect(next.assignment.personIds).toEqual(['p2', 'p1']);
  });
});

describe('pickDefaultPersonId', () => {
  it('returns candidate if valid, otherwise first person or empty string', () => {
    expect(pickDefaultPersonId(people, 'p2')).toBe('p2');
    expect(pickDefaultPersonId(people, 'missing')).toBe('p1');
    expect(pickDefaultPersonId([], 'missing')).toBe('');
  });
});
