import { describe, expect, it } from 'vitest';
import { personColor } from '@features/ux-prototypes/logic/personPalette';

describe('personColor', () => {
  it('gives the first ten people distinct colours', () => {
    const colours = Array.from({ length: 10 }, (_, index) => personColor(index));
    expect(new Set(colours).size).toBe(10);
  });

  it('cycles back to the first colour for an eleventh person', () => {
    expect(personColor(10)).toBe(personColor(0));
  });
});
