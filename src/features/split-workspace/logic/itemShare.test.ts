import { describe, expect, it } from 'vitest';
import type { EditableItem, ItemAssignment } from '@shared/types';
import {
  allocateItemShares,
  formatShareFraction,
  parseShareInput,
  resolvePersonShare,
  setPersonShare,
  stepPersonShare,
} from './itemShare';

function buildItem(assignment: Partial<ItemAssignment>, amountInput = '12.00'): EditableItem {
  return {
    id: 'i1',
    name: 'Garlic bread',
    amountInput,
    discountPercentInput: '',
    assignment: { mode: 'equal', personId: '', personIds: [], ...assignment },
  };
}

function sharesOf(item: EditableItem, priceCents = 1200) {
  const { personIds, weights, unassignedWeight } = item.assignment;
  return allocateItemShares(priceCents, personIds, weights, unassignedWeight);
}

describe('allocateItemShares', () => {
  it('charges claimants only their slice and leaves the unassigned share out', () => {
    expect(allocateItemShares(1200, ['a'], { a: 1 }, 1)).toEqual({ a: 600 });
    expect(allocateItemShares(1000, ['a', 'b'], { a: 1, b: 1 }, 1)).toEqual({ a: 334, b: 333 });
  });

  it('splits equally without weights', () => {
    expect(allocateItemShares(1000, ['a', 'b', 'c'], undefined, undefined)).toEqual({
      a: 334,
      b: 333,
      c: 333,
    });
  });
});

describe('resolvePersonShare', () => {
  it('shows an equal three-way split as 1/3 that can go either way', () => {
    const share = resolvePersonShare(buildItem({ personIds: ['a', 'b', 'c'] }), 'a', 1200);

    expect(share).toEqual({
      label: '1/3',
      isWhole: false,
      amountCents: 400,
      canIncrease: true,
      canDecrease: true,
    });
  });

  it('lets + go from a half to the whole item', () => {
    const share = resolvePersonShare(
      buildItem({ personIds: ['a', 'b'], weights: { a: 1, b: 1 } }),
      'a',
      1200,
    );

    expect(share).toMatchObject({ label: '1/2', isWhole: false, canIncrease: true });
  });

  it('labels a solo item as whole and an odd typed split as a percent', () => {
    expect(resolvePersonShare(buildItem({ personIds: ['a'] }), 'a', 1200)).toMatchObject({
      label: 'Whole',
      isWhole: true,
      canIncrease: false,
      canDecrease: true,
    });
    expect(
      resolvePersonShare(
        buildItem({ personIds: ['a', 'b'], weights: { a: 1476, b: 2214 } }),
        'a',
        3690,
      ),
    ).toMatchObject({ label: '2/5' });
    expect(
      resolvePersonShare(buildItem({ personIds: ['a', 'b'], weights: { a: 37, b: 63 } }), 'a', 1200)
        ?.label,
    ).toBe('37%');
  });

  it('returns null for someone who is not on the item', () => {
    expect(resolvePersonShare(buildItem({ personIds: ['a'] }), 'b', 1200)).toBeNull();
  });
});

describe('stepPersonShare', () => {
  it('halves a solo item and leaves the other half unassigned', () => {
    const next = stepPersonShare(buildItem({ personIds: ['a'] }), 'a', 'decrease');

    expect(next.assignment).toMatchObject({
      personIds: ['a'],
      weights: { a: 1 },
      unassignedWeight: 1,
    });
    expect(sharesOf(next)).toEqual({ a: 600 });
  });

  it('takes a solo item back to whole and clears the unassigned share', () => {
    const half = buildItem({ personIds: ['a'], weights: { a: 1 }, unassignedWeight: 1 });

    const next = stepPersonShare(half, 'a', 'increase');

    expect(next.assignment).toMatchObject({
      personIds: ['a'],
      weights: undefined,
      unassignedWeight: undefined,
    });
  });

  it('gives Alice half of a three-way item and splits the rest between the others', () => {
    const next = stepPersonShare(buildItem({ personIds: ['a', 'b', 'c'] }), 'a', 'increase');

    expect(next.assignment.weights).toEqual({ a: 2, b: 1, c: 1 });
    expect(sharesOf(next)).toEqual({ a: 600, b: 300, c: 300 });
  });

  it('shrinks Alice to a quarter and keeps the unassigned share in proportion', () => {
    const item = buildItem({ personIds: ['a', 'b'], weights: { a: 1, b: 1 }, unassignedWeight: 1 });

    const next = stepPersonShare(item, 'a', 'decrease');

    expect(next.assignment).toMatchObject({ weights: { a: 2, b: 3 }, unassignedWeight: 3 });
  });

  it('snaps a typed share to the next step in the direction tapped', () => {
    const item = buildItem({ personIds: ['a', 'b'], weights: { a: 37, b: 63 } });

    expect(resolvePersonShare(stepPersonShare(item, 'a', 'decrease'), 'a', 1200)?.label).toBe(
      '1/3',
    );
    expect(resolvePersonShare(stepPersonShare(item, 'a', 'increase'), 'a', 1200)?.label).toBe(
      '1/2',
    );
  });

  it('takes everyone else off the item when Alice steps up from a half to the whole', () => {
    const next = stepPersonShare(buildItem({ personIds: ['a', 'b'] }), 'a', 'increase');

    expect(next.assignment).toMatchObject({ personIds: ['a'], weights: undefined });
    expect(sharesOf(next)).toEqual({ a: 1200 });
  });

  it('does nothing past the smallest step', () => {
    const tenth = buildItem({ personIds: ['a'], weights: { a: 1 }, unassignedWeight: 9 });

    expect(stepPersonShare(tenth, 'a', 'decrease')).toBe(tenth);
  });
});

describe('setPersonShare', () => {
  it('takes a typed amount out of the others in proportion', () => {
    const next = setPersonShare(buildItem({ personIds: ['a', 'b', 'c'] }), 'a', {
      kind: 'amount',
      cents: 600,
    });

    expect(sharesOf(next)).toEqual({ a: 600, b: 300, c: 300 });
  });

  it('turns a typed percent into the matching amount', () => {
    const next = setPersonShare(buildItem({ personIds: ['a', 'b'] }), 'a', {
      kind: 'percent',
      value: 25,
    });

    expect(sharesOf(next)).toEqual({ a: 300, b: 900 });
  });

  it('leaves the rest of a solo item unassigned when Alice types less than the price', () => {
    const next = setPersonShare(buildItem({ personIds: ['a'] }), 'a', {
      kind: 'amount',
      cents: 500,
    });

    expect(next.assignment).toMatchObject({
      personIds: ['a'],
      unassignedWeight: 7,
      weights: { a: 5 },
    });
    expect(sharesOf(next)).toEqual({ a: 500 });
  });

  it('takes someone off the item when their share is typed down to zero', () => {
    const next = setPersonShare(buildItem({ personIds: ['a', 'b'] }), 'a', {
      kind: 'amount',
      cents: 0,
    });

    expect(next.assignment.personIds).toEqual(['b']);
    expect(next.assignment.weights).toBeUndefined();
  });

  it('caps a typed amount at the item price', () => {
    const next = setPersonShare(buildItem({ personIds: ['a', 'b'] }), 'a', {
      kind: 'amount',
      cents: 5000,
    });

    expect(next.assignment.personIds).toEqual(['a']);
    expect(sharesOf(next)).toEqual({ a: 1200 });
  });

  it('accepts a typed fraction', () => {
    const next = setPersonShare(buildItem({ personIds: ['a'] }), 'a', {
      kind: 'fraction',
      divisor: 3,
    });

    expect(sharesOf(next)).toEqual({ a: 400 });
  });

  it('ignores an amount or percent on an item without a price', () => {
    const item = buildItem({ personIds: ['a', 'b'] }, '');

    expect(setPersonShare(item, 'a', { kind: 'amount', cents: 100 })).toBe(item);
  });
});

describe('parseShareInput', () => {
  it('reads amounts, percents and unit fractions', () => {
    expect(parseShareInput('8.50')).toEqual({ kind: 'amount', cents: 850 });
    expect(parseShareInput('$8.50')).toEqual({ kind: 'amount', cents: 850 });
    expect(parseShareInput(' 40 % ')).toEqual({ kind: 'percent', value: 40 });
    expect(parseShareInput('1/3')).toEqual({ kind: 'fraction', divisor: 3 });
  });

  it('rejects blank or unreadable input', () => {
    expect(parseShareInput('')).toBeNull();
    expect(parseShareInput('lots')).toBeNull();
    expect(parseShareInput('abc%')).toBeNull();
  });
});

describe('formatShareFraction', () => {
  it('reduces small fractions and falls back to a percent', () => {
    expect(formatShareFraction(3, 3)).toBe('Whole');
    expect(formatShareFraction(3, 12)).toBe('1/4');
    expect(formatShareFraction(4, 6)).toBe('2/3');
    expect(formatShareFraction(1, 11)).toBe('9%');
  });
});
