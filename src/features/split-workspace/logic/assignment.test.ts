import { describe, expect, it } from 'vitest';
import type { EditableItem, Person } from '@shared/types';
import {
  NOBODY,
  buildInitialItems,
  createDefaultItem,
  equalShares,
  hasEqualShares,
  isItemAssigned,
  makeAssignment,
  syncItemsWithPeople,
} from './assignment';

const people: Person[] = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
];

function item(assignment = NOBODY): EditableItem {
  return { id: 'i1', name: 'Laksa', amountInput: '5.00', discountPercentInput: '', assignment };
}

describe('makeAssignment', () => {
  it('stores one form for the same split, whatever scale the weights came in', () => {
    expect(makeAssignment({ p1: 60, p2: 40 })).toEqual({
      shares: { p1: 3, p2: 2 },
      unassignedShare: 0,
    });
    expect(makeAssignment({ p1: 4, p2: 4 })).toEqual(equalShares(['p1', 'p2']));
    expect(makeAssignment({ p1: 2 }, 4)).toEqual({ shares: { p1: 1 }, unassignedShare: 2 });
  });

  it('drops people whose share is not positive', () => {
    expect(makeAssignment({ p1: 0, p2: 3, p3: -1 })).toEqual(equalShares(['p2']));
  });

  it('forgets an unassigned share that has nobody beside it', () => {
    expect(makeAssignment({}, 3)).toEqual(NOBODY);
    expect(makeAssignment({ p1: 0 }, 3)).toEqual(NOBODY);
  });

  it('keeps people in the order they were given', () => {
    expect(Object.keys(equalShares(['p2', 'p1']).shares)).toEqual(['p2', 'p1']);
  });
});

describe('hasEqualShares', () => {
  it('is true only when everyone on the item has the same share and nothing is left', () => {
    expect(hasEqualShares(NOBODY)).toBe(true);
    expect(hasEqualShares(equalShares(['p1', 'p2']))).toBe(true);
    expect(hasEqualShares(makeAssignment({ p1: 2, p2: 1 }))).toBe(false);
    expect(hasEqualShares(makeAssignment({ p1: 1 }, 1))).toBe(false);
  });
});

describe('isItemAssigned', () => {
  const valid = new Set(['p1', 'p2']);

  it('needs someone in the split on the item, and none of it left over', () => {
    expect(isItemAssigned(item(equalShares(['p1'])), valid)).toBe(true);
    expect(isItemAssigned(item(NOBODY), valid)).toBe(false);
    expect(isItemAssigned(item(equalShares(['removed'])), valid)).toBe(false);
    expect(isItemAssigned(item(makeAssignment({ p1: 1 }, 1)), valid)).toBe(false);
  });
});

describe('syncItemsWithPeople', () => {
  it('takes a removed person off the item and leaves the rest in the same ratio', () => {
    const [synced] = syncItemsWithPeople([item(makeAssignment({ p1: 2, p2: 4, gone: 1 }))], people);

    expect(synced.assignment).toEqual({ shares: { p1: 1, p2: 2 }, unassignedShare: 0 });
  });

  it('keeps the unassigned share of a half-claimed item when someone else leaves', () => {
    const [synced] = syncItemsWithPeople([item(makeAssignment({ p1: 1, gone: 1 }, 1))], people);

    expect(synced.assignment).toEqual({ shares: { p1: 1 }, unassignedShare: 1 });
  });

  it('leaves nothing unassigned once nobody valid is on the item', () => {
    const [synced] = syncItemsWithPeople([item(makeAssignment({ gone: 1 }, 1))], people);

    expect(synced.assignment).toEqual(NOBODY);
  });

  it('returns the same item when everyone on it is still in the split', () => {
    const unchanged = item(makeAssignment({ p1: 2, p2: 1 }));

    expect(syncItemsWithPeople([unchanged], people)[0]).toBe(unchanged);
  });

  it('takes everyone off when the split has no people', () => {
    const [synced] = syncItemsWithPeople([item(equalShares(['p1', 'p2']))], []);

    expect(synced.assignment).toEqual(NOBODY);
  });
});

describe('buildInitialItems', () => {
  it('returns a single unclaimed blank item when items is empty', () => {
    expect(buildInitialItems([], people)).toEqual([
      {
        id: expect.any(String),
        name: '',
        amountInput: '',
        discountPercentInput: '',
        assignment: NOBODY,
      },
    ]);
  });

  it('syncs existing items with people when items are present', () => {
    const [synced] = buildInitialItems([item(equalShares(['p1', 'gone']))], people);

    expect(synced.assignment).toEqual(equalShares(['p1']));
  });
});

describe('createDefaultItem', () => {
  it('creates a blank item that nobody has claimed yet', () => {
    const blank = createDefaultItem();

    expect(blank.assignment).toEqual(NOBODY);
    expect(blank.id).not.toBe(createDefaultItem().id);
  });
});
