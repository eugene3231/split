import { describe, expect, it } from 'vitest';
import { sameStringArray } from '@shared/logic/core/id';

describe('sameStringArray', () => {
  it('returns true for identical arrays', () => {
    expect(sameStringArray(['a', 'b'], ['a', 'b'])).toBe(true);
  });

  it('returns false for different lengths', () => {
    expect(sameStringArray(['a'], ['a', 'b'])).toBe(false);
  });

  it('returns false for same length but different content', () => {
    expect(sameStringArray(['a', 'c'], ['a', 'b'])).toBe(false);
  });

  it('returns true for empty arrays', () => {
    expect(sameStringArray([], [])).toBe(true);
  });
});
