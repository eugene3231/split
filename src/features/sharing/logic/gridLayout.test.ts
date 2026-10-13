import { describe, expect, it } from 'vitest';
import { chooseGridLayout, layoutGrid } from './gridLayout';

describe('layoutGrid', () => {
  it('fills rows left to right and lines each row up to its tallest card', () => {
    const layout = layoutGrid([500, 200, 300, 400], 2, 10);
    expect(layout.placements).toEqual([
      { column: 0, y: 0, height: 500 },
      { column: 1, y: 0, height: 500 },
      { column: 0, y: 510, height: 400 },
      { column: 1, y: 510, height: 400 },
    ]);
    expect(layout.height).toBe(910);
  });

  it('leaves the last row short when the cards run out', () => {
    const layout = layoutGrid([300, 300, 300], 2, 10);
    expect(layout.placements[2]).toEqual({ column: 0, y: 310, height: 300 });
  });

  it('has no height without cards', () => {
    expect(layoutGrid([], 1, 10).height).toBe(0);
  });
});

describe('chooseGridLayout', () => {
  const choose = (heights: number[]) =>
    chooseGridLayout({
      heights,
      maxColumns: 4,
      gap: 0,
      widthFor: (columns) => columns * 800,
      heightFor: (body) => body + 200,
    });

  it('keeps one person in one column', () => {
    expect(choose([1200]).columns).toBe(1);
  });

  it('spreads twelve people across more columns than five', () => {
    expect(choose(Array.from({ length: 5 }, () => 1000)).columns).toBe(3);
    expect(choose(Array.from({ length: 12 }, () => 1000)).columns).toBe(4);
  });

  it('never uses more columns than there are people', () => {
    expect(choose([3000, 3000]).columns).toBe(2);
  });
});
