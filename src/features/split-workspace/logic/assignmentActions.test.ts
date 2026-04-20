import { describe, expect, it } from 'vitest';
import type { EditableItem, Person } from '@shared/types';
import { togglePersonInAssignment, selectAllPeople, selectNone } from './assignmentActions';

const people: Person[] = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
  { id: 'p3', name: 'Cara' },
];

function buildItem(overrides: Partial<EditableItem> = {}): EditableItem {
  return {
    id: 'i1',
    name: 'Laksa',
    amountInput: '10.00',
    discountPercentInput: '',
    assignment: {
      mode: 'equal',
      personId: '',
      personIds: ['p1', 'p2'],
    },
    ...overrides,
  };
}

describe('togglePersonInAssignment', () => {
  it('adds a person to the assignment', () => {
    const result = togglePersonInAssignment('p3', true, buildItem());
    expect(result.assignment.personIds).toEqual(['p1', 'p2', 'p3']);
    expect(result.assignment.mode).toBe('equal');
  });

  it('removes a person from the assignment', () => {
    const result = togglePersonInAssignment('p1', false, buildItem());
    expect(result.assignment.personIds).toEqual(['p2']);
  });

  it('does not duplicate when adding an existing person', () => {
    const result = togglePersonInAssignment('p1', true, buildItem());
    expect(result.assignment.personIds).toEqual(['p1', 'p2']);
  });

  it('sets mode to equal', () => {
    const item = buildItem({ assignment: { mode: 'single', personId: 'p1', personIds: ['p1'] } });
    const result = togglePersonInAssignment('p2', true, item);
    expect(result.assignment.mode).toBe('equal');
  });
});

describe('selectAllPeople', () => {
  it('assigns all people in equal mode', () => {
    const result = selectAllPeople(people, buildItem());
    expect(result.assignment.personIds).toEqual(['p1', 'p2', 'p3']);
    expect(result.assignment.mode).toBe('equal');
  });
});

describe('selectNone', () => {
  it('clears all people from the assignment', () => {
    const result = selectNone(buildItem());
    expect(result.assignment.personIds).toEqual([]);
    expect(result.assignment.mode).toBe('equal');
  });
});

describe('weight preservation', () => {
  it('togglePersonInAssignment adds a person with default weight 1', () => {
    const item = buildItem({
      assignment: {
        mode: 'equal',
        personId: '',
        personIds: ['p1', 'p2'],
        weights: { p1: 2, p2: 1 },
      },
    });
    const result = togglePersonInAssignment('p3', true, item);
    expect(result.assignment.personIds).toEqual(['p1', 'p2', 'p3']);
    expect(result.assignment.weights).toEqual({ p1: 2, p2: 1, p3: 1 });
  });

  it('togglePersonInAssignment removes person and their weight entry', () => {
    const item = buildItem({
      assignment: {
        mode: 'equal',
        personId: '',
        personIds: ['p1', 'p2'],
        weights: { p1: 2, p2: 1 },
      },
    });
    const result = togglePersonInAssignment('p1', false, item);
    expect(result.assignment.personIds).toEqual(['p2']);
    expect(result.assignment.weights).toBeUndefined();
  });

  it('selectAllPeople clears weights (reset to equal)', () => {
    const item = buildItem({
      assignment: {
        mode: 'equal',
        personId: '',
        personIds: ['p1', 'p2'],
        weights: { p1: 2, p2: 1 },
      },
    });
    const result = selectAllPeople(people, item);
    expect(result.assignment.weights).toBeUndefined();
  });

  it('selectNone clears weights', () => {
    const item = buildItem({
      assignment: {
        mode: 'equal',
        personId: '',
        personIds: ['p1', 'p2'],
        weights: { p1: 2, p2: 1 },
      },
    });
    const result = selectNone(item);
    expect(result.assignment.weights).toBeUndefined();
  });
});
