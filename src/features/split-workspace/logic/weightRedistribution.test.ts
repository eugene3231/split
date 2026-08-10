import { describe, expect, it } from 'vitest';
import { redistributeOnChange } from './weightRedistribution';

describe('redistributeOnChange', () => {
  it('pulls the difference from others proportional to their current share', () => {
    const next = redistributeOnChange({ a: 20, b: 30, c: 50 }, 'a', 40, 100, ['a', 'b', 'c']);
    expect(next).toEqual({ a: 40, b: 23, c: 37 });
    expect(next.a + next.b + next.c).toBe(100);
  });

  it('uses largest-remainder allocation so the total stays exact even when rounding would overflow', () => {
    const next = redistributeOnChange({ a: 0, b: 4, c: 3, d: 3 }, 'a', 1, 10, ['a', 'b', 'c', 'd']);
    expect(next).toEqual({ a: 1, b: 3, c: 3, d: 3 });
    expect(next.a + next.b + next.c + next.d).toBe(10);
  });

  it('clamps the edited value to [0, total]', () => {
    const above = redistributeOnChange({ a: 20, b: 80 }, 'a', 150, 100, ['a', 'b']);
    expect(above).toEqual({ a: 100, b: 0 });

    const below = redistributeOnChange({ a: 20, b: 80 }, 'a', -10, 100, ['a', 'b']);
    expect(below).toEqual({ a: 0, b: 100 });
  });

  it('is a no-op when the new value equals the current value', () => {
    const prev = { a: 20, b: 80 };
    const next = redistributeOnChange(prev, 'a', 20, 100, ['a', 'b']);
    expect(next).toBe(prev);
  });

  it('splits evenly among others that are all currently zero', () => {
    const next = redistributeOnChange({ a: 90, b: 0, c: 0 }, 'a', 60, 90, ['a', 'b', 'c']);
    expect(next).toEqual({ a: 60, b: 15, c: 15 });
    expect(next.a + next.b + next.c).toBe(90);
  });

  it('keeps the exact total when six people are involved and rounding could overflow', () => {
    const prev = { p0: 5, p1: 14, p2: 24, p3: 41, p4: 13, p5: 3 };
    const ids = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'];

    const next = redistributeOnChange(prev, 'p3', 93, 100, ids);

    expect(next.p3).toBe(93);
    expect(Object.values(next).reduce((sum, value) => sum + value, 0)).toBe(100);
  });
});
