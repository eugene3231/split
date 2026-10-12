import { describe, expect, it } from 'vitest';
import type { EditableItem } from '@shared/types';
import { assignEveryItemEqually, canSplitEvenly } from '@features/split-workspace/logic/evenSplit';
import { equalShares, makeAssignment } from '@features/split-workspace/logic/assignment';

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
    assignment: equalShares(personIds),
  };
}

describe('assignEveryItemEqually', () => {
  it('gives every item to everyone in equal shares, replacing what was there', () => {
    const weighted: EditableItem = {
      ...item('beer', '12'),
      assignment: makeAssignment({ p1: 1 }, 1),
    };

    const result = assignEveryItemEqually([item('rice', '10'), weighted], people);

    expect(result.map((entry) => entry.assignment)).toEqual([
      equalShares(['p1', 'p2', 'p3']),
      equalShares(['p1', 'p2', 'p3']),
    ]);
  });

  it('leaves items alone when there is nobody to split with', () => {
    const items = [item('rice', '10')];

    expect(assignEveryItemEqually(items, [])).toBe(items);
  });
});

describe('canSplitEvenly', () => {
  it('disables sharing only when every item is already equal among everyone', () => {
    const tea = (shares: Record<string, number>, unassignedShare = 0) => [
      { ...item('tea', '2'), assignment: makeAssignment(shares, unassignedShare) },
    ];
    expect(canSplitEvenly(tea({ p3: 1, p1: 1, p2: 1 }), people)).toBe(false);
    expect(canSplitEvenly(tea({ p1: 2, p2: 2, p3: 2 }), people)).toBe(false);
    expect(canSplitEvenly(tea({ p1: 3, p2: 2, p3: 2 }), people)).toBe(true);
    expect(canSplitEvenly(tea({ p1: 2, p2: 2, p3: 2 }, 1), people)).toBe(true);
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

  it('can replace an item one person has to themselves', () => {
    expect(canSplitEvenly([item('tea', '2', ['p2'])], people)).toBe(true);
  });
});
