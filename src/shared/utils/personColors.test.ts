import { describe, expect, it } from 'vitest';
import { personColor } from '@shared/utils/personColors';

describe('personColor', () => {
  it('gives each of the first ten people a distinct colour', () => {
    const colors = Array.from({ length: 10 }, (_, index) => personColor(index));
    expect(new Set(colors).size).toBe(10);
  });

  it('wraps around after ten people', () => {
    expect(personColor(10)).toBe(personColor(0));
    expect(personColor(13)).toBe(personColor(3));
  });
});
