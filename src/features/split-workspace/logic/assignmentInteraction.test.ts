import { describe, expect, it } from 'vitest';
import type { ChargeState, EditableItem, Person, Receipt } from '@shared/types';
import {
  applyAssignmentCommand,
  resolveAssignmentInteraction,
  splitUnassignedItemsEqually,
  togglePersonInAssignment,
} from './assignmentInteraction';

const disabledCharge: ChargeState = {
  enabled: false,
  mode: 'percent',
  amountInput: '',
  percentInput: '',
  detectedConfidence: null,
  detectedSource: null,
};

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

function buildReceipt(items: EditableItem[]): Receipt {
  return {
    id: 'r1',
    name: 'Receipt 1',
    items,
    discount: disabledCharge,
    serviceCharge: disabledCharge,
    gst: disabledCharge,
    receiptTotalInput: '',
    currency: 'SGD',
    exchangeRateOverride: null,
  };
}

function resolve(items: EditableItem[], activeItemIndex = 0) {
  return resolveAssignmentInteraction({
    items,
    receipts: [buildReceipt(items)],
    people,
    phase: 'assign',
    activeItemIndex,
    currency: 'SGD',
  });
}

describe('resolveAssignmentInteraction', () => {
  it('resolves active item state and equal share previews', () => {
    const interaction = resolve([buildItem()]);

    expect(interaction.assign.activeItem).toMatchObject({
      id: 'i1',
      title: 'Laksa',
      priceCents: 1200,
      priceLabel: '$12.00',
      isAssigned: true,
      weightsInputMode: 'shares',
      canUseSplitControls: true,
    });
    expect(interaction.assign.activeItemPositionLabel).toBe('Item 1 of 1');
    expect(
      interaction.assign.people.map((row) => [row.name, row.isSelected, row.shareLabel]),
    ).toEqual([
      ['Alice', true, '$6.00'],
      ['Bob', true, '$6.00'],
      ['Cara', false, '$0.00'],
    ]);
  });

  it('defaults weightsInputMode to shares when the stored assignment has none', () => {
    const interaction = resolve([
      buildItem({
        assignment: {
          mode: 'equal',
          personId: '',
          personIds: ['p1', 'p2'],
          weights: { p1: 2, p2: 1 },
        },
      }),
    ]);

    expect(interaction.assign.activeItem?.weightsInputMode).toBe('shares');
    expect(interaction.assign.people.map((row) => [row.id, row.weight, row.shareLabel])).toEqual([
      ['p1', 2, '$8.00'],
      ['p2', 1, '$4.00'],
      ['p3', 1, '$0.00'],
    ]);
  });

  it('resolves empty active item state', () => {
    const interaction = resolve([], 0);

    expect(interaction.assign.activeItem).toBeNull();
    expect(interaction.assign.activeItemPositionLabel).toBe('');
    expect(interaction.assign.people).toEqual([]);
    expect(interaction.review.rows).toEqual([]);
  });

  it('sums shareAmountCents exactly to the item price for an odd-thirds split', () => {
    const interaction = resolve([
      buildItem({
        amountInput: '10.00',
        assignment: {
          mode: 'equal',
          personId: '',
          personIds: ['p1', 'p2', 'p3'],
        },
      }),
    ]);

    const total = interaction.assign.people
      .filter((row) => row.isSelected)
      .reduce((sum, row) => sum + row.shareAmountCents, 0);
    expect(total).toBe(1000);
  });

  it('resolves review rows for equal, shares, percent, and amount assignments', () => {
    const interaction = resolve([
      buildItem({ id: 'equal', name: 'Toast' }),
      buildItem({
        id: 'shares',
        name: 'Coffee',
        assignment: {
          mode: 'equal',
          personId: '',
          personIds: ['p1', 'p2'],
          weights: { p1: 2, p2: 1 },
        },
      }),
      buildItem({
        id: 'legacy',
        name: 'Tea',
        assignment: {
          mode: 'equal',
          personId: '',
          personIds: ['p1', 'p2'],
          weights: { p1: 3, p2: 1 },
          weightsInputMode: undefined,
        },
      }),
      buildItem({
        id: 'percent',
        name: 'Cake',
        amountInput: '10.00',
        assignment: {
          mode: 'equal',
          personId: '',
          personIds: ['p1', 'p2'],
          weights: { p1: 60, p2: 40 },
          weightsInputMode: 'percent',
        },
      }),
      buildItem({
        id: 'amount',
        name: 'Wine',
        amountInput: '10.00',
        assignment: {
          mode: 'equal',
          personId: '',
          personIds: ['p1', 'p2'],
          weights: { p1: 700, p2: 300 },
          weightsInputMode: 'amount',
        },
      }),
      buildItem({
        id: 'empty',
        name: 'Napkins',
        assignment: { mode: 'equal', personId: '', personIds: [] },
      }),
    ]);

    expect(interaction.review.rows.map((row) => [row.title, row.splitLabel])).toEqual([
      ['Toast', 'Split: Alice, Bob'],
      ['Coffee', 'Split: Alice ×2, Bob ×1'],
      ['Tea', 'Split: Alice ×3, Bob ×1'],
      ['Cake', 'Split: Alice 60%, Bob 40%'],
      ['Wine', 'Split: Alice $7.00, Bob $3.00'],
      ['Napkins', 'No people selected'],
    ]);
  });

  it('resolves review rows across every receipt, not just the active one', () => {
    const receipt1 = buildReceipt([buildItem({ id: 'r1-item', name: 'Toast' })]);
    const receipt2: Receipt = {
      ...buildReceipt([buildItem({ id: 'r2-item', name: 'Coffee' })]),
      id: 'r2',
      name: 'Receipt 2',
    };

    const interaction = resolveAssignmentInteraction({
      items: receipt1.items,
      receipts: [receipt1, receipt2],
      people,
      phase: 'review',
      activeItemIndex: 0,
      currency: 'SGD',
    });

    expect(interaction.review.itemCount).toBe(2);
    expect(
      interaction.review.rows.map((row) => [row.receiptId, row.receiptName, row.title]),
    ).toEqual([
      ['r1', 'Receipt 1', 'Toast'],
      ['r2', 'Receipt 2', 'Coffee'],
    ]);
  });

  it('resolves whether split unassigned can run', () => {
    const interaction = resolve([
      buildItem({
        id: 'empty',
        assignment: { mode: 'equal', personId: '', personIds: [] },
      }),
    ]);

    expect(interaction.assign.canSplitUnassigned).toBe(true);
    expect(interaction.assign.unassignedItemCount).toBe(1);
  });

  it('falls back to an untitled name and a dash price when name/amount are missing', () => {
    const interaction = resolve([buildItem({ name: '', amountInput: '' })]);

    expect(interaction.assign.activeItem).toMatchObject({
      title: 'Untitled item',
      priceCents: null,
      priceLabel: '—',
    });
    // With no parsed price, every selected person's share falls back to $0,
    // not just the unselected ones.
    expect(
      interaction.assign.people.map((row) => [row.name, row.isSelected, row.shareAmountCents]),
    ).toEqual([
      ['Alice', true, 0],
      ['Bob', true, 0],
      ['Cara', false, 0],
    ]);
    // Review rows use the raw item name (no "Untitled item" fallback) and a
    // null price label rather than a dash.
    expect(interaction.review.rows[0]).toMatchObject({
      title: '',
      priceCents: null,
      priceLabel: null,
    });
  });

  it('treats a missing weight entry as an implicit 1 when detecting and labeling unequal splits', () => {
    const interaction = resolve([
      buildItem({
        assignment: {
          mode: 'equal',
          personId: '',
          // p3 listed first with no weights entry, so detecting "unequal"
          // must fall back to 1 for it before reaching p1's real weight.
          personIds: ['p3', 'p1', 'p2'],
          weights: { p1: 2, p2: 1 },
        },
      }),
    ]);

    expect(interaction.review.rows[0].splitLabel).toBe('Split: Alice ×2, Bob ×1, Cara ×1');
  });

  it('labels a shares split correctly even when the item price cannot be parsed', () => {
    const interaction = resolve([
      buildItem({
        amountInput: '',
        assignment: {
          mode: 'equal',
          personId: '',
          personIds: ['p1', 'p2'],
          weights: { p1: 2, p2: 1 },
        },
      }),
    ]);

    expect(interaction.review.rows[0].splitLabel).toBe('Split: Alice ×2, Bob ×1');
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

  it('clears everyone and weights on select-none', () => {
    const item = buildItem({
      assignment: {
        mode: 'equal',
        personId: '',
        personIds: ['p1', 'p2'],
        weights: { p1: 2, p2: 1 },
      },
    });

    const result = applyAssignmentCommand({
      command: { type: 'select-none' },
      item,
      people,
    });

    expect(result).toMatchObject({
      type: 'item-updated',
      item: { assignment: { personIds: [], weights: undefined } },
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
    const interaction = resolve([next]);
    const chris = interaction.assign.people.find((row) => row.id === 'p3');
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

  it('assigns only one person and clears weights', () => {
    const item = buildItem({
      assignment: {
        mode: 'equal',
        personId: '',
        personIds: ['p1', 'p2'],
        weights: { p1: 2, p2: 1 },
      },
    });

    const result = applyAssignmentCommand({
      command: { type: 'assign-only', personId: 'p2' },
      item,
      people,
    });

    expect(result).toMatchObject({
      type: 'item-updated',
      item: { assignment: { personIds: ['p2'], weights: undefined } },
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
