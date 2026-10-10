import { describe, expect, it } from 'vitest';
import type { EditableItem, Person } from '@shared/types';
import {
  getAssignedItemsCount,
  getDetectedItemsCount,
  hasAnyValidReceiptItem,
  isStepValid,
} from './wizardValidation';

const people: Person[] = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Ben' },
];

function buildItem(overrides: Partial<EditableItem> = {}): EditableItem {
  return {
    id: 'i1',
    name: 'Item',
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

describe('wizardValidation', () => {
  it('detects valid receipt items from parseable amounts', () => {
    const items = [buildItem(), buildItem({ id: 'i2', amountInput: 'bad' })];

    expect(hasAnyValidReceiptItem(items)).toBe(true);
    expect(getDetectedItemsCount(items)).toBe(1);
  });

  it('counts assigned items in equal mode only', () => {
    const items = [
      buildItem({ id: 'i1', assignment: { mode: 'equal', personId: '', personIds: ['p1'] } }),
      buildItem({ id: 'i2', assignment: { mode: 'single', personId: 'p1', personIds: ['p1'] } }),
      buildItem({ id: 'i3', assignment: { mode: 'equal', personId: '', personIds: [] } }),
    ];

    expect(getAssignedItemsCount(items, people)).toBe(1);
  });

  it('does not count assigned blank or invalid rows toward priced assignments', () => {
    const items = [
      buildItem(),
      buildItem({ id: 'blank', amountInput: '' }),
      buildItem({ id: 'invalid', amountInput: 'bad' }),
    ];

    expect(getAssignedItemsCount(items, people)).toBe(1);
    expect(isStepValid('items', { items, people })).toBe(true);
  });

  it('requires assignment for the priced row when a blank row is already assigned', () => {
    const items = [
      buildItem({ assignment: { mode: 'equal', personId: '', personIds: [] } }),
      buildItem({ id: 'blank', amountInput: '' }),
    ];

    expect(getDetectedItemsCount(items)).toBe(1);
    expect(getAssignedItemsCount(items, people)).toBe(0);
    expect(isStepValid('items', { items, people })).toBe(false);
  });

  it('requires a current person even when an amount is valid', () => {
    const items = [
      buildItem({ assignment: { mode: 'equal', personId: '', personIds: ['removed'] } }),
    ];

    expect(getAssignedItemsCount(items, people)).toBe(0);
    expect(isStepValid('items', { items, people })).toBe(false);
  });

  it('includes assigned zero-price and fully discounted rows in the same item count', () => {
    const items = [
      buildItem({ id: 'zero', amountInput: '0.00' }),
      buildItem({ id: 'discounted', discountPercentInput: '100' }),
    ];

    expect(getDetectedItemsCount(items)).toBe(2);
    expect(getAssignedItemsCount(items, people)).toBe(2);
    expect(isStepValid('items', { items, people })).toBe(true);
  });

  it('validates grouped wizard steps', () => {
    const validItems = [buildItem()];
    const invalidItems = [buildItem({ amountInput: '' })];

    expect(isStepValid('people', { items: [], people })).toBe(true);
    expect(isStepValid('people', { items: [], people: [] })).toBe(false);

    expect(isStepValid('receipt', { items: validItems, people })).toBe(true);
    expect(isStepValid('receipt', { items: invalidItems, people })).toBe(false);

    expect(isStepValid('items', { items: validItems, people })).toBe(true);
    expect(
      isStepValid('items', {
        items: [buildItem({ assignment: { mode: 'equal', personId: '', personIds: [] } })],
        people,
      }),
    ).toBe(false);
  });

  it('rejects items step when no items have valid amounts', () => {
    const itemsWithBadAmounts = [buildItem({ amountInput: 'bad' }), buildItem({ amountInput: '' })];

    expect(isStepValid('items', { items: itemsWithBadAmounts, people })).toBe(false);
    expect(getDetectedItemsCount(itemsWithBadAmounts)).toBe(0);
  });
});
