import { describe, expect, it } from 'vitest';
import type { EditableItem, Receipt } from '@shared/types';
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

function receipt(items: EditableItem[]): Receipt {
  return { items } as Receipt;
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
  it('is offered once two people share a priced item nobody has claimed', () => {
    expect(canSplitEvenly([receipt([item('rice', '10')])], people)).toBe(true);
  });

  it('is not offered for one person', () => {
    expect(canSplitEvenly([receipt([item('rice', '10')])], people.slice(0, 1))).toBe(false);
  });

  it('is not offered before any item has a price', () => {
    expect(canSplitEvenly([receipt([item('rice', '')])], people)).toBe(false);
  });

  it('is not offered once anyone has claimed an item on any receipt', () => {
    const receipts = [receipt([item('rice', '10')]), receipt([item('tea', '2', ['p2'])])];

    expect(canSplitEvenly(receipts, people)).toBe(false);
  });
});
