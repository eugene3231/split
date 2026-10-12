import { describe, expect, it } from 'vitest';
import type { EditableItem, Person } from '@shared/types';
import { makeAssignment } from './assignment';
import {
  applyAssignmentCommand,
  setPersonOnEveryItem,
  splitUnassignedItemsEqually,
  togglePersonInAssignment,
} from './assignmentInteraction';
import { allocateItemShares } from './itemShare';

const people: Person[] = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
  { id: 'p3', name: 'Cara' },
];

function buildItem(
  shares: Record<string, number>,
  unassignedShare = 0,
  overrides: Partial<EditableItem> = {},
): EditableItem {
  return {
    id: 'i1',
    name: 'Laksa',
    amountInput: '12.00',
    discountPercentInput: '',
    assignment: makeAssignment(shares, unassignedShare),
    ...overrides,
  };
}

function sharesOf(item: EditableItem, priceCents = 1200) {
  return allocateItemShares(priceCents, item.assignment);
}

describe('togglePersonInAssignment', () => {
  it('gives a newcomer an average share and keeps the ratio between the others', () => {
    const next = togglePersonInAssignment(
      'p3',
      true,
      buildItem({ p1: 2880, p2: 1920 }, 0, { amountInput: '48.00' }),
    );

    expect(sharesOf(next, 4800)).toEqual({ p1: 1920, p2: 1280, p3: 1600 });
  });

  it('gives the unassigned share of a half-claimed item to whoever ticks it next', () => {
    const item = buildItem({ p1: 1 }, 1);

    const next = togglePersonInAssignment('p2', true, item);

    expect(next.assignment).toEqual({ shares: { p1: 1, p2: 1 }, unassignedShare: 0 });
  });

  it("adds a leaver's slice to the unassigned share instead of handing it to the others", () => {
    const item = buildItem({ p1: 1, p2: 1 }, 2);

    const next = togglePersonInAssignment('p2', false, item);

    expect(next.assignment).toEqual({ shares: { p1: 1 }, unassignedShare: 3 });
  });

  it('leaves nobody on the item, and nothing unassigned, when the last person unticks', () => {
    const item = buildItem({ p1: 1 }, 1);

    const next = togglePersonInAssignment('p1', false, item);

    expect(next.assignment).toEqual({ shares: {}, unassignedShare: 0 });
  });

  it('gives the whole item to the one person left', () => {
    const next = togglePersonInAssignment('p2', false, buildItem({ p1: 60, p2: 40 }));

    expect(next.assignment).toEqual({ shares: { p1: 1 }, unassignedShare: 0 });
  });

  it('leaves the item untouched when the person is already in that state', () => {
    const item = buildItem({ p1: 1, p2: 1 });

    expect(togglePersonInAssignment('p1', true, item)).toBe(item);
    expect(togglePersonInAssignment('p3', false, item)).toBe(item);
  });
});

describe('applyAssignmentCommand', () => {
  it('routes share steps and typed shares to the item', () => {
    const halved = applyAssignmentCommand(buildItem({ p1: 1 }), {
      type: 'step-share',
      personId: 'p1',
      step: 'decrease',
    });
    expect(halved.assignment.unassignedShare).toBe(1);

    const typed = applyAssignmentCommand(buildItem({ p1: 1, p2: 1 }), {
      type: 'set-share',
      personId: 'p1',
      input: { kind: 'amount', cents: 900 },
    });
    expect(sharesOf(typed)).toEqual({ p1: 900, p2: 300 });
  });

  it('splits an item evenly between everyone, dropping custom shares and any part left', () => {
    const next = applyAssignmentCommand(buildItem({ p1: 1 }, 1), {
      type: 'split-evenly',
      personIds: ['p1', 'p2', 'p3'],
    });

    expect(next.assignment).toEqual({ shares: { p1: 1, p2: 1, p3: 1 }, unassignedShare: 0 });
    expect(sharesOf(next)).toEqual({ p1: 400, p2: 400, p3: 400 });
  });

  it('gives the whole item to one person', () => {
    const next = applyAssignmentCommand(buildItem({ p1: 2, p2: 1 }), {
      type: 'only-person',
      personId: 'p2',
    });

    expect(next.assignment).toEqual({ shares: { p2: 1 }, unassignedShare: 0 });
  });
});

describe('splitUnassignedItemsEqually', () => {
  it('keeps assigned weighted items intact and assigns only unassigned items', () => {
    const weightedItem = buildItem({ p1: 2, p2: 1 }, 0, { id: 'weighted' });
    const unassignedItem = buildItem({}, 0, { id: 'unassigned' });

    const result = splitUnassignedItemsEqually([weightedItem, unassignedItem], people);

    expect(result[0]).toBe(weightedItem);
    expect(result[1].assignment).toEqual({ shares: { p1: 1, p2: 1, p3: 1 }, unassignedShare: 0 });
  });

  it('splits the unassigned half of an item evenly while Alice keeps her half', () => {
    const item = buildItem({ p1: 1 }, 1);

    const [result] = splitUnassignedItemsEqually([item], people);

    expect(result.assignment.unassignedShare).toBe(0);
    expect(sharesOf(result)).toEqual({ p1: 800, p2: 200, p3: 200 });
  });

  it('returns items unchanged when there are no people to split with', () => {
    const items = [buildItem({})];

    expect(splitUnassignedItemsEqually(items, [])).toBe(items);
  });

  it('treats items assigned only to stale people as unassigned', () => {
    const [result] = splitUnassignedItemsEqually([buildItem({ removed: 1 })], people);

    expect(result.assignment.shares).toEqual({ p1: 1, p2: 1, p3: 1 });
  });
});

describe('setPersonOnEveryItem', () => {
  it('adds the person to items they are not on and leaves the rest as they were', () => {
    const open = buildItem({}, 0, { id: 'open' });
    const theirs = buildItem({ p3: 1, p1: 1 }, 0, { id: 'theirs' });

    const [nextOpen, nextTheirs] = setPersonOnEveryItem([open, theirs], 'p3', true);

    expect(nextOpen.assignment.shares).toEqual({ p3: 1 });
    expect(nextTheirs).toBe(theirs);
  });

  it('removes the person from every item and keeps the other people', () => {
    const next = setPersonOnEveryItem(
      [buildItem({ p1: 1, p2: 1 }), buildItem({ p1: 1 }, 0, { id: 'i2' })],
      'p1',
      false,
    );

    expect(next.map((item) => item.assignment.shares)).toEqual([{ p2: 1 }, {}]);
  });

  it('takes the unassigned share of a part-assigned item', () => {
    const [next] = setPersonOnEveryItem([buildItem({ p1: 1 }, 1)], 'p2', true);

    expect(next.assignment.unassignedShare).toBe(0);
    expect(sharesOf(next)).toEqual({ p1: 600, p2: 600 });
  });

  it('skips items without a price, which the step does not list', () => {
    const unpriced = buildItem({}, 0, { amountInput: '' });

    expect(setPersonOnEveryItem([unpriced], 'p1', true)).toEqual([unpriced]);
  });
});
