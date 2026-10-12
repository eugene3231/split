import { describe, expect, it } from 'vitest';
import { isNonEmpty, mapNonEmpty } from './nonEmpty';

describe('non-empty arrays', () => {
  it('tells an empty array from one with entries', () => {
    expect(isNonEmpty([])).toBe(false);
    expect(isNonEmpty(['a'])).toBe(true);
  });

  it('maps every entry in order and passes each its index', () => {
    expect(mapNonEmpty(['a', 'b', 'c'], (value, index) => `${index}:${value}`)).toEqual([
      '0:a',
      '1:b',
      '2:c',
    ]);
  });
});
