import { describe, expect, it } from 'vitest';
import type { EditableItem, Person } from '@shared/types';
import {
  applyAssignmentCommand,
  resolveSplitAdjustment,
  splitUnassignedItemsEqually,
  togglePersonInAssignment,
} from './assignmentInteraction';

const people: Person[] = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
  { id: 'p3', name: 'Cara' },
];

function buildItem(overrides: Partial<EditableItem> = {}): EditableItem {
  return {
    id: 'i1',
    name: 'Laksa',
    amountInput: '12.00',
    discountPercentInput: '',
    assignment: { mode: 'equal', personId: '', personIds: ['p1', 'p2'] },
    ...overrides,
  };
}

function resolve(item: EditableItem, currency = 'SGD') {
  return resolveSplitAdjustment({ item, people, currency });
}

describe('resolveSplitAdjustment', () => {
  it('lists only the claimants with equal share previews', () => {
    const adjustment = resolve(buildItem());

    expect(adjustment).toMatchObject({
      itemId: 'i1',
      title: 'Laksa',
      priceLabel: '$12.00',
      weightsInputMode: 'shares',
      totalWeight: 2,
    });
    expect(adjustment.claimants.map((row) => [row.name, row.shareLabel, row.percentValue])).toEqual(
      [
        ['Alice', '$6.00', 50],
        ['Bob', '$6.00', 50],
      ],
    );
  });

  it('keeps people order and colour slots regardless of the order they were claimed in', () => {
    const adjustment = resolve(
      buildItem({ assignment: { mode: 'equal', personId: '', personIds: ['p3', 'p1'] } }),
    );

    expect(adjustment.claimants.map((row) => [row.id, row.colorIndex])).toEqual([
      ['p1', 0],
      ['p3', 2],
    ]);
  });

  it('defaults weightsInputMode to shares and reads saved weights', () => {
    const adjustment = resolve(
      buildItem({
        assignment: {
          mode: 'equal',
          personId: '',
          personIds: ['p1', 'p2'],
          weights: { p1: 2, p2: 1 },
        },
      }),
    );

    expect(adjustment.weightsInputMode).toBe('shares');
    expect(adjustment.totalWeight).toBe(3);
    expect(adjustment.claimants.map((row) => [row.id, row.weight, row.shareLabel])).toEqual([
      ['p1', 2, '$8.00'],
      ['p2', 1, '$4.00'],
    ]);
  });

  it('sums shareAmountCents exactly to the item price for an odd-thirds split', () => {
    const adjustment = resolve(
      buildItem({
        amountInput: '10.00',
        assignment: { mode: 'equal', personId: '', personIds: ['p1', 'p2', 'p3'] },
      }),
    );

    const total = adjustment.claimants.reduce((sum, row) => sum + row.shareAmountCents, 0);
    expect(total).toBe(1000);
  });

  it('labels shares in the receipt currency', () => {
    const adjustment = resolve(buildItem(), 'USD');

    expect(adjustment.priceLabel).toBe('US$12.00');
    expect(adjustment.claimants[0].shareLabel).toBe('US$6.00');
  });

  it('falls back to an untitled name, a dash price and zero shares without a price', () => {
    const adjustment = resolve(buildItem({ name: '', amountInput: '' }));

    expect(adjustment).toMatchObject({ title: 'Untitled item', priceLabel: '—' });
    expect(adjustment.claimants.map((row) => row.shareAmountCents)).toEqual([0, 0]);
  });
});

describe('applyAssignmentCommand', () => {
  it('ignores every command when there is no active item', () => {
    const result = applyAssignmentCommand({
      command: { type: 'select-all' },
      item: null,
      people,
    });

    expect(result).toEqual({ type: 'ignored' });
  });

  it('selects everyone and clears weights on select-all', () => {
    const item = buildItem({
      assignment: { mode: 'equal', personId: '', personIds: ['p1'], weights: { p1: 2 } },
    });

    const result = applyAssignmentCommand({
      command: { type: 'select-all' },
      item,
      people,
    });

    expect(result).toMatchObject({
      type: 'item-updated',
      item: { assignment: { personIds: ['p1', 'p2', 'p3'], weights: undefined } },
    });
  });

  it('adjusts the share weight relative to an implicit weight of 1 when none is saved yet', () => {
    const item = buildItem({
      assignment: { mode: 'equal', personId: '', personIds: ['p1', 'p2'] },
    });

    const result = applyAssignmentCommand({
      command: { type: 'adjust-weight', personId: 'p1', delta: 2 },
      item,
      people,
    });

    expect(result).toMatchObject({
      type: 'item-updated',
      item: { assignment: { weights: { p1: 3, p2: 1 } } },
    });
  });

  it('seeds a default weight of 1 for untouched people the first time a share weight is set', () => {
    const item = buildItem({
      assignment: { mode: 'equal', personId: '', personIds: ['p1', 'p2'] },
    });

    const result = applyAssignmentCommand({
      command: { type: 'set-weight', personId: 'p1', value: 3 },
      item,
      people,
    });

    expect(result).toMatchObject({
      type: 'item-updated',
      item: { assignment: { weights: { p1: 3, p2: 1 }, weightsInputMode: 'shares' } },
    });
  });

  it('ignores a share-weight update for a person who is not part of the assignment', () => {
    const item = buildItem({
      assignment: { mode: 'equal', personId: '', personIds: ['p1', 'p2'] },
    });

    const result = applyAssignmentCommand({
      command: { type: 'set-weight', personId: 'p3', value: 5 },
      item,
      people,
    });

    expect(result).toMatchObject({ type: 'item-updated', item: { assignment: item.assignment } });
  });

  it('toggles people while preserving share weights when possible', () => {
    const item = buildItem({
      assignment: {
        mode: 'equal',
        personId: '',
        personIds: ['p1', 'p2'],
        weights: { p1: 2, p2: 1 },
      },
    });

    const result = applyAssignmentCommand({
      command: { type: 'toggle-person', personId: 'p3', checked: true },
      item,
      people,
    });

    expect(result).toMatchObject({
      type: 'item-updated',
      item: {
        assignment: {
          personIds: ['p1', 'p2', 'p3'],
          weights: { p1: 2, p2: 1, p3: 1 },
        },
      },
    });
  });

  it('renormalizes a newcomer into an amount-mode assignment as a fair share, not weight ?? 1', () => {
    const item = buildItem({
      amountInput: '48.00',
      assignment: {
        mode: 'equal',
        personId: '',
        personIds: ['p1', 'p2'],
        weights: { p1: 2880, p2: 1920 },
        weightsInputMode: 'amount',
      },
    });

    const next = togglePersonInAssignment('p3', true, item);

    expect(next.assignment.personIds).toEqual(['p1', 'p2', 'p3']);
    expect(next.assignment.weightsInputMode).toBe('amount');

    // Rendered as dollars, Chris lands close to an equal three-way share of
    // the $48 item — not the old `weight ?? 1` default (~1 cent).
    const chris = resolve(next).claimants.find((row) => row.id === 'p3');
    expect(chris?.shareAmountCents).toBe(1600);
  });

  it('clears weightsInputMode when toggling drops weights entirely', () => {
    const item = buildItem({
      assignment: {
        mode: 'equal',
        personId: '',
        personIds: ['p1', 'p2'],
        weights: { p1: 60, p2: 40 },
        weightsInputMode: 'percent',
      },
    });

    const next = togglePersonInAssignment('p2', false, item);

    expect(next.assignment.personIds).toEqual(['p1']);
    expect(next.assignment.weights).toBeUndefined();
    expect(next.assignment.weightsInputMode).toBeUndefined();
  });

  it('does not duplicate a person already in the assignment', () => {
    const item = buildItem({
      assignment: { mode: 'equal', personId: '', personIds: ['p1', 'p2'] },
    });

    const next = togglePersonInAssignment('p1', true, item);

    expect(next.assignment.personIds).toEqual(['p1', 'p2']);
  });

  it('switches single-person mode to equal mode when toggling in a second person', () => {
    const item = buildItem({ assignment: { mode: 'single', personId: 'p1', personIds: ['p1'] } });

    const next = togglePersonInAssignment('p2', true, item);

    expect(next.assignment.mode).toBe('equal');
    expect(next.assignment.personIds).toEqual(['p1', 'p2']);
  });

  it('preserves weightsInputMode when toggling a person while unweighted, staying at 2+ selected', () => {
    const item = buildItem({
      assignment: {
        mode: 'equal',
        personId: '',
        personIds: ['p1', 'p2', 'p3'],
        weightsInputMode: 'percent',
      },
    });

    const next = togglePersonInAssignment('p3', false, item);

    expect(next.assignment.personIds).toEqual(['p1', 'p2']);
    expect(next.assignment.weightsInputMode).toBe('percent');
  });

  it('preserves weightsInputMode on select-all when 2+ people result', () => {
    const item = buildItem({
      assignment: {
        mode: 'equal',
        personId: '',
        personIds: ['p1'],
        weightsInputMode: 'percent',
      },
    });

    const result = applyAssignmentCommand({
      command: { type: 'select-all' },
      item,
      people,
    });

    expect(result).toMatchObject({
      type: 'item-updated',
      item: { assignment: { personIds: ['p1', 'p2', 'p3'], weightsInputMode: 'percent' } },
    });
  });

  it('clamps share weights to at least one', () => {
    const item = buildItem({
      assignment: {
        mode: 'equal',
        personId: '',
        personIds: ['p1', 'p2'],
        weights: { p1: 2, p2: 1 },
      },
    });

    const result = applyAssignmentCommand({
      command: { type: 'set-weight', personId: 'p1', value: -10 },
      item,
      people,
    });

    expect(result).toMatchObject({
      type: 'item-updated',
      item: { assignment: { weights: { p1: 1, p2: 1 }, weightsInputMode: 'shares' } },
    });
  });

  it('relabels the active tab without touching weights', () => {
    const item = buildItem({
      assignment: {
        mode: 'equal',
        personId: '',
        personIds: ['p1', 'p2'],
        weights: { p1: 2, p2: 1 },
        weightsInputMode: 'shares',
      },
    });

    const result = applyAssignmentCommand({
      command: { type: 'set-weights-input-mode', mode: 'percent' },
      item,
      people,
    });

    expect(result).toMatchObject({
      type: 'item-updated',
      item: { assignment: { weights: { p1: 2, p2: 1 }, weightsInputMode: 'percent' } },
    });
  });

  it('resets a split to equal while leaving weightsInputMode untouched', () => {
    const item = buildItem({
      assignment: {
        mode: 'equal',
        personId: '',
        personIds: ['p1', 'p2'],
        weights: { p1: 60, p2: 40 },
        weightsInputMode: 'percent',
      },
    });

    const result = applyAssignmentCommand({
      command: { type: 'reset-split-to-equal' },
      item,
      people,
    });

    expect(result).toMatchObject({
      type: 'item-updated',
      item: { assignment: { weights: undefined, weightsInputMode: 'percent' } },
    });
  });

  it('commits a percent redistribution and tags the assignment as percent-mode', () => {
    const item = buildItem({
      amountInput: '10.00',
      assignment: {
        mode: 'equal',
        personId: '',
        personIds: ['p1', 'p2'],
      },
    });

    const result = applyAssignmentCommand({
      command: { type: 'set-percent', personId: 'p1', value: 70 },
      item,
      people,
    });

    expect(result).toMatchObject({
      type: 'item-updated',
      item: {
        assignment: {
          personIds: ['p1', 'p2'],
          weights: { p1: 70, p2: 30 },
          weightsInputMode: 'percent',
        },
      },
    });
  });

  it('deselects a person driven to exactly 0% by a percent commit', () => {
    const item = buildItem({
      amountInput: '10.00',
      assignment: {
        mode: 'equal',
        personId: '',
        personIds: ['p1', 'p2'],
      },
    });

    const result = applyAssignmentCommand({
      command: { type: 'set-percent', personId: 'p1', value: 100 },
      item,
      people,
    });

    expect(result).toMatchObject({
      type: 'item-updated',
      item: { assignment: { personIds: ['p1'], weights: undefined } },
    });
  });

  it('no-ops a percent commit when fewer than two people are selected', () => {
    const item = buildItem({
      amountInput: '10.00',
      assignment: { mode: 'equal', personId: '', personIds: ['p1'] },
    });

    const result = applyAssignmentCommand({
      command: { type: 'set-percent', personId: 'p1', value: 50 },
      item,
      people,
    });

    expect(result).toMatchObject({ type: 'item-updated', item: { assignment: item.assignment } });
  });

  it('drops only the person driven to 0% and renormalizes the remaining survivors', () => {
    const item = buildItem({
      amountInput: '10.00',
      assignment: { mode: 'equal', personId: '', personIds: ['p1', 'p2', 'p3'] },
    });

    const result = applyAssignmentCommand({
      command: { type: 'set-percent', personId: 'p1', value: 0 },
      item,
      people,
    });

    expect(result.type).toBe('item-updated');
    const updatedItem = (result as { type: 'item-updated'; item: EditableItem }).item;
    expect(updatedItem.assignment.personIds).toEqual(['p2', 'p3']);
    expect(updatedItem.assignment.weightsInputMode).toBe('percent');
    const weights = updatedItem.assignment.weights!;
    expect(Object.keys(weights).sort()).toEqual(['p2', 'p3']);
    expect(weights.p2 + weights.p3).toBe(100);
  });

  it('does not let re-normalization after a zero-weight drop alter the value just typed', () => {
    const item = buildItem({
      amountInput: '10.00',
      assignment: {
        mode: 'equal',
        personId: '',
        personIds: ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'],
        weights: { p0: 5, p1: 14, p2: 24, p3: 41, p4: 13, p5: 3 },
        weightsInputMode: 'percent',
      },
    });

    const result = applyAssignmentCommand({
      command: { type: 'set-percent', personId: 'p3', value: 93 },
      item,
      people,
    });

    expect(result.type).toBe('item-updated');
    if (result.type !== 'item-updated') throw new Error('expected item-updated');
    expect(result.item.assignment.weights?.p3).toBe(93);
    const total = Object.values(result.item.assignment.weights ?? {}).reduce(
      (sum, value) => sum + value,
      0,
    );
    expect(total).toBe(100);
  });

  it('commits an amount redistribution and tags the assignment as amount-mode', () => {
    const item = buildItem({
      amountInput: '10.00',
      assignment: {
        mode: 'equal',
        personId: '',
        personIds: ['p1', 'p2'],
      },
    });

    const result = applyAssignmentCommand({
      command: { type: 'set-amount', personId: 'p1', valueCents: 700 },
      item,
      people,
    });

    expect(result).toMatchObject({
      type: 'item-updated',
      item: {
        assignment: {
          personIds: ['p1', 'p2'],
          weights: { p1: 700, p2: 300 },
          weightsInputMode: 'amount',
        },
      },
    });
  });

  it('no-ops an amount commit when the item has no parsed price', () => {
    const item = buildItem({
      amountInput: '',
      assignment: {
        mode: 'equal',
        personId: '',
        personIds: ['p1', 'p2'],
      },
    });

    const result = applyAssignmentCommand({
      command: { type: 'set-amount', personId: 'p1', valueCents: 700 },
      item,
      people,
    });

    expect(result).toMatchObject({ type: 'item-updated', item: { assignment: item.assignment } });
  });
});

describe('splitUnassignedItemsEqually', () => {
  it('keeps assigned weighted items intact and assigns only unassigned items', () => {
    const weightedItem = buildItem({
      id: 'weighted',
      assignment: {
        mode: 'equal',
        personId: '',
        personIds: ['p1', 'p2'],
        weights: { p1: 2, p2: 1 },
      },
    });
    const unassignedItem = buildItem({
      id: 'unassigned',
      assignment: { mode: 'equal', personId: '', personIds: [] },
    });

    const result = splitUnassignedItemsEqually([weightedItem, unassignedItem], people);

    expect(result[0]).toBe(weightedItem);
    expect(result[1].assignment).toEqual({
      mode: 'equal',
      personId: '',
      personIds: ['p1', 'p2', 'p3'],
      weights: undefined,
    });
  });

  it('returns items unchanged when there are no people to split with', () => {
    const items = [buildItem({ assignment: { mode: 'equal', personId: '', personIds: [] } })];

    const result = splitUnassignedItemsEqually(items, []);

    expect(result).toBe(items);
  });

  it('treats items assigned only to stale people as unassigned', () => {
    const staleItem = buildItem({
      id: 'stale',
      assignment: { mode: 'equal', personId: '', personIds: ['removed-person'] },
    });

    const result = splitUnassignedItemsEqually([staleItem], people);

    expect(result[0].assignment.personIds).toEqual(['p1', 'p2', 'p3']);
  });
});
