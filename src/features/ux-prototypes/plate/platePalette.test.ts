import { describe, expect, it } from 'vitest';
import { plateColor } from './platePalette';

describe('plateColor', () => {
  it('gives the first five people distinct colours', () => {
    const colours = [0, 1, 2, 3, 4].map(plateColor);
    expect(new Set(colours).size).toBe(5);
  });

  it('cycles back to the first colour for a sixth person', () => {
    expect(plateColor(5)).toBe(plateColor(0));
  });
});
