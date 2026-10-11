import { describe, expect, it } from 'vitest';
import type { EditableItem } from '@shared/types';
import { assignEveryItemEqually, canSplitEvenly } from '@features/split-workspace/logic/evenSplit';

const people = [
  { id: 'p1', name: 'Ana' },
  { id: 'p2', name: 'Ben' },
  { id: 'p3', name: 'Cai' },
];

function item(id: string, amountInput: string, personIds: string[] = []): EditableItem {
  return {
    id,
    name: id,
    amountInput,
    discountPercentInput: '',
    assignment: { mode: 'equal', personId: '', personIds },
  };
}

describe('assignEveryItemEqually', () => {
  it('gives every item to everyone in equal shares, replacing weights', () => {
    const weighted: EditableItem = {
      ...item('beer', '12', ['p1']),
      assignment: {
        mode: 'equal',
        personId: '',
        personIds: ['p1'],
        weights: { p1: 1 },
        unassignedWeight: 1,
      },
    };

    const result = assignEveryItemEqually([item('rice', '10'), weighted], people);

    expect(result.map((entry) => entry.assignment)).toEqual([
      { mode: 'equal', personId: '', personIds: ['p1', 'p2', 'p3'] },
      { mode: 'equal', personId: '', personIds: ['p1', 'p2', 'p3'] },
    ]);
  });

  it('leaves items alone when there is nobody to split with', () => {
    const items = [item('rice', '10')];

    expect(assignEveryItemEqually(items, [])).toBe(items);
  });
});

describe('canSplitEvenly', () => {
  it('disables sharing only when every item is already equal among everyone', () => {
    const shared = item('tea', '2', ['p3', 'p1', 'p2']);
    expect(canSplitEvenly([shared], people)).toBe(false);
    shared.assignment.weights = { p1: 2, p2: 2, p3: 2 };
    expect(canSplitEvenly([shared], people)).toBe(false);
    shared.assignment.weights.p1 = 3;
    expect(canSplitEvenly([shared], people)).toBe(true);
    shared.assignment.weights.p1 = 2;
    shared.assignment.unassignedWeight = 1;
    expect(canSplitEvenly([shared], people)).toBe(true);
  });

  it('is offered once two people share a priced item nobody has claimed', () => {
    expect(canSplitEvenly([item('rice', '10')], people)).toBe(true);
  });

  it('is not offered for one person', () => {
    expect(canSplitEvenly([item('rice', '10')], people.slice(0, 1))).toBe(false);
  });

  it('is not offered before any item has a price', () => {
    expect(canSplitEvenly([item('rice', '')], people)).toBe(false);
  });

  it('is available after someone has claimed an item on this receipt', () => {
    expect(canSplitEvenly([item('rice', '10'), item('tea', '2', ['p2'])], people)).toBe(true);
  });

  it('can replace a single-person assignment', () => {
    const claimed = item('tea', '2');
    claimed.assignment = { mode: 'single', personId: 'p2', personIds: [] };
    expect(canSplitEvenly([claimed], people)).toBe(true);
  });
});
