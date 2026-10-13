import { describe, expect, it } from 'vitest';
import { allocate, allocateCents } from '@features/split-workspace/logic/split/allocation';

describe('allocate', () => {
  it('shares a total in proportion to the weights', () => {
    expect(allocate(1000, [1, 3])).toEqual([250, 750]);
  });

  it('gives a spare cent to the largest remainder', () => {
    // 100 * 2/3 = 66.67 and 100 * 1/3 = 33.33
    expect(allocate(100, [1, 2])).toEqual([33, 67]);
  });

  it('gives a spare cent to the lower index when remainders tie', () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
  });

  it('lets a higher priority win a tie ahead of the index', () => {
    expect(allocate(100, [1, 1, 1], [0, 0, 1])).toEqual([33, 33, 34]);
  });

  it('shares evenly when no weight is positive', () => {
    expect(allocate(10, [0, -5])).toEqual([5, 5]);
  });

  it('gives nothing to a weight that is not positive beside one that is', () => {
    expect(allocate(10, [-5, 2])).toEqual([0, 10]);
  });

  it('keeps the sign of a negative total', () => {
    expect(allocate(-100, [1, 1, 1])).toEqual([-34, -33, -33]);
  });

  it('returns zeros for a zero total and nothing for no weights', () => {
    expect(allocate(0, [1, 2])).toEqual([0, 0]);
    expect(allocate(100, [])).toEqual([]);
  });
});

describe('allocateCents', () => {
  it('gives a spare cent to the person id that sorts first, whatever order they are listed in', () => {
    expect(allocateCents(100, ['b', 'c', 'a'], { a: 1, b: 1, c: 1 })).toEqual({
      a: 34,
      b: 33,
      c: 33,
    });
  });

  it('lets a tie priority win ahead of the id', () => {
    expect(allocateCents(100, ['a', 'b', 'c'], { a: 1, b: 1, c: 1 }, { c: 1 })).toEqual({
      a: 33,
      b: 33,
      c: 34,
    });
  });

  it('treats a person with no weight as zero', () => {
    expect(allocateCents(100, ['a', 'b'], { a: 1 })).toEqual({ a: 100, b: 0 });
  });

  it('returns a zero for everyone when there is nothing to share', () => {
    expect(allocateCents(0, ['a', 'b'], { a: 1, b: 1 })).toEqual({ a: 0, b: 0 });
  });
});
