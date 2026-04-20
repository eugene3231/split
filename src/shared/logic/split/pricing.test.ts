import { describe, expect, it } from 'vitest';
import type { EditableItem } from '@shared/types';
import { parseDiscountPercent, resolveDiscountedAmountCents } from '@shared/logic/split/pricing';

function buildItem(overrides: Partial<EditableItem> = {}): EditableItem {
  return {
    id: 'item-1',
    name: 'Item',
    amountInput: '10.00',
    discountPercentInput: '',
    assignment: {
      mode: 'single',
      personId: '',
      personIds: [],
    },
    ...overrides,
  };
}

describe('parseDiscountPercent', () => {
  it('returns 0 for empty/invalid values and clamps valid range', () => {
    expect(parseDiscountPercent('')).toBe(0);
    expect(parseDiscountPercent('abc')).toBe(0);
    expect(parseDiscountPercent('-5')).toBe(0);
    expect(parseDiscountPercent('12.5')).toBe(12.5);
    expect(parseDiscountPercent('120')).toBe(100);
  });
});

describe('resolveDiscountedAmountCents', () => {
  it('returns null when amount cannot be parsed', () => {
    expect(resolveDiscountedAmountCents(buildItem({ amountInput: '' }))).toBeNull();
  });

  it('computes discounted net cents with rounding', () => {
    expect(
      resolveDiscountedAmountCents(
        buildItem({
          amountInput: '10.01',
          discountPercentInput: '12.5',
        }),
      ),
    ).toBe(876);
  });

  it('never returns negative cents when discount exceeds 100%', () => {
    expect(
      resolveDiscountedAmountCents(
        buildItem({
          amountInput: '8.50',
          discountPercentInput: '200',
        }),
      ),
    ).toBe(0);
  });
});
