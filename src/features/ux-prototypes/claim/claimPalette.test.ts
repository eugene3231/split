import { describe, expect, it } from 'vitest';
import { claimColor } from './claimPalette';

describe('claimColor', () => {
  it('gives the first five people distinct colours', () => {
    const colours = [0, 1, 2, 3, 4].map(claimColor);
    expect(new Set(colours).size).toBe(5);
  });

  it('cycles back to the first colour for a sixth person', () => {
    expect(claimColor(5)).toBe(claimColor(0));
  });
});
