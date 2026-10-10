import { describe, expect, it } from 'vitest';
import type { EditableItem, ItemAssignment, Person } from '@shared/types';
import {
  applyAssignmentCommand,
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
  assignment: Partial<ItemAssignment> = {},
  overrides: Partial<EditableItem> = {},
): EditableItem {
  return {
    id: 'i1',
    name: 'Laksa',
    amountInput: '12.00',
    discountPercentInput: '',
    assignment: { mode: 'equal', personId: '', personIds: ['p1', 'p2'], ...assignment },
    ...overrides,
  };
}

function sharesOf(item: EditableItem, priceCents = 1200) {
  const { personIds, weights, unassignedWeight } = item.assignment;
  return allocateItemShares(priceCents, personIds, weights, unassignedWeight);
}

describe('togglePersonInAssignment', () => {
  it('keeps custom share weights and gives a newcomer the average weight', () => {
    const next = togglePersonInAssignment(
      'p3',
      true,
      buildItem({ weights: { p1: 2880, p2: 1920 } }, { amountInput: '48.00' }),
    );

    expect(next.assignment.personIds).toEqual(['p1', 'p2', 'p3']);
    expect(sharesOf(next, 4800).p3).toBe(1600);
  });

  it('gives the unassigned share of a half-claimed item to whoever ticks it next', () => {
    const item = buildItem({ personIds: ['p1'], weights: { p1: 1 }, unassignedWeight: 1 });

    const next = togglePersonInAssignment('p2', true, item);

    expect(next.assignment).toMatchObject({
      personIds: ['p1', 'p2'],
      weights: { p1: 1, p2: 1 },
      unassignedWeight: undefined,
    });
  });

  it("adds a leaver's slice to the unassigned share instead of handing it to the others", () => {
    const item = buildItem({
      personIds: ['p1', 'p2'],
      weights: { p1: 1, p2: 1 },
      unassignedWeight: 2,
    });

    const next = togglePersonInAssignment('p2', false, item);

    expect(next.assignment).toMatchObject({
      personIds: ['p1'],
      weights: { p1: 1 },
      unassignedWeight: 3,
    });
  });

  it('clears weights and the unassigned share when the last claimant unticks', () => {
    const item = buildItem({ personIds: ['p1'], weights: { p1: 1 }, unassignedWeight: 1 });

    const next = togglePersonInAssignment('p1', false, item);

    expect(next.assignment).toMatchObject({
      personIds: [],
      weights: undefined,
      unassignedWeight: undefined,
    });
  });

  it('drops custom weights when only one claimant is left', () => {
    const next = togglePersonInAssignment('p2', false, buildItem({ weights: { p1: 60, p2: 40 } }));

    expect(next.assignment).toMatchObject({ personIds: ['p1'], weights: undefined });
  });

  it('leaves the item untouched when the person is already in that state', () => {
    const item = buildItem();

    expect(togglePersonInAssignment('p1', true, item)).toBe(item);
    expect(togglePersonInAssignment('p3', false, item)).toBe(item);
  });

  it('switches single-person mode to equal mode when toggling in a second person', () => {
    const item = buildItem({ mode: 'single', personId: 'p1', personIds: ['p1'] });

    const next = togglePersonInAssignment('p2', true, item);

    expect(next.assignment.mode).toBe('equal');
    expect(next.assignment.personIds).toEqual(['p1', 'p2']);
  });
});

describe('applyAssignmentCommand', () => {
  it('routes share steps and typed shares to the item', () => {
    const halved = applyAssignmentCommand(buildItem({ personIds: ['p1'] }), {
      type: 'step-share',
      personId: 'p1',
      step: 'decrease',
    });
    expect(halved.assignment.unassignedWeight).toBe(1);

    const typed = applyAssignmentCommand(buildItem(), {
      type: 'set-share',
      personId: 'p1',
      input: { kind: 'amount', cents: 900 },
    });
    expect(sharesOf(typed)).toEqual({ p1: 900, p2: 300 });
  });

  it('splits an item evenly between everyone, dropping custom shares and any part left', () => {
    const next = applyAssignmentCommand(
      buildItem({ personIds: ['p1'], weights: { p1: 1 }, unassignedWeight: 1 }),
      { type: 'split-evenly', personIds: ['p1', 'p2', 'p3'] },
    );

    expect(next.assignment).toEqual({
      mode: 'equal',
      personId: '',
      personIds: ['p1', 'p2', 'p3'],
    });
    expect(sharesOf(next)).toEqual({ p1: 400, p2: 400, p3: 400 });
  });

  it('gives the whole item to one person', () => {
    const next = applyAssignmentCommand(buildItem({ weights: { p1: 2, p2: 1 } }), {
      type: 'only-person',
      personId: 'p2',
    });

    expect(next.assignment).toEqual({ mode: 'equal', personId: '', personIds: ['p2'] });
  });
});

describe('splitUnassignedItemsEqually', () => {
  it('keeps assigned weighted items intact and assigns only unassigned items', () => {
    const weightedItem = buildItem({ weights: { p1: 2, p2: 1 } }, { id: 'weighted' });
    const unassignedItem = buildItem({ personIds: [] }, { id: 'unassigned' });

    const result = splitUnassignedItemsEqually([weightedItem, unassignedItem], people);

    expect(result[0]).toBe(weightedItem);
    expect(result[1].assignment).toEqual({
      mode: 'equal',
      personId: '',
      personIds: ['p1', 'p2', 'p3'],
      weights: undefined,
    });
  });

  it('splits the unassigned half of an item evenly while Alice keeps her half', () => {
    const item = buildItem({ personIds: ['p1'], weights: { p1: 1 }, unassignedWeight: 1 });

    const [result] = splitUnassignedItemsEqually([item], people);

    expect(result.assignment.unassignedWeight).toBeUndefined();
    expect(sharesOf(result)).toEqual({ p1: 800, p2: 200, p3: 200 });
  });

  it('returns items unchanged when there are no people to split with', () => {
    const items = [buildItem({ personIds: [] })];

    expect(splitUnassignedItemsEqually(items, [])).toBe(items);
  });

  it('treats items assigned only to stale people as unassigned', () => {
    const [result] = splitUnassignedItemsEqually([buildItem({ personIds: ['removed'] })], people);

    expect(result.assignment.personIds).toEqual(['p1', 'p2', 'p3']);
  });
});
