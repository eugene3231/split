import { describe, expect, it } from 'vitest';
import type { ChargeState, EditableItem, Person, Receipt } from '@shared/types';
import {
  applyAssignmentCommand,
  resolveAssignmentInteraction,
  splitUnassignedItemsEqually,
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
      splitMode: 'equal',
      canUseShares: true,
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

  it('resolves weighted share previews', () => {
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

    expect(interaction.assign.activeItem?.splitMode).toBe('shares');
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

  it('resolves review rows for equal and weighted assignments', () => {
    const interaction = resolve([
      buildItem({ id: 'equal', name: 'Toast' }),
      buildItem({
        id: 'weighted',
        name: 'Coffee',
        assignment: {
          mode: 'equal',
          personId: '',
          personIds: ['p1', 'p2'],
          weights: { p1: 2, p2: 1 },
        },
      }),
      buildItem({
        id: 'empty',
        name: 'Cake',
        assignment: { mode: 'equal', personId: '', personIds: [] },
      }),
    ]);

    expect(interaction.review.rows.map((row) => [row.title, row.splitLabel])).toEqual([
      ['Toast', 'Split: Alice, Bob'],
      ['Coffee', 'Split: Alice ×2, Bob ×1'],
      ['Cake', 'No people selected'],
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
});

describe('applyAssignmentCommand', () => {
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

  it('switches between equal and shares mode', () => {
    const item = buildItem();
    const shares = applyAssignmentCommand({
      command: { type: 'set-split-mode', mode: 'shares' },
      item,
      people,
    });

    expect(shares).toMatchObject({
      type: 'item-updated',
      item: { assignment: { weights: { p1: 1, p2: 1 } } },
    });

    const equal = applyAssignmentCommand({
      command: { type: 'set-split-mode', mode: 'equal' },
      item: shares.type === 'item-updated' ? shares.item : item,
      people,
    });

    expect(equal).toMatchObject({
      type: 'item-updated',
      item: { assignment: { weights: undefined } },
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
      item: { assignment: { weights: { p1: 1, p2: 1 } } },
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
});
