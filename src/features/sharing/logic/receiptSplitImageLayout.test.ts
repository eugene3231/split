import { describe, expect, it } from 'vitest';
import { chooseMasonryLayout, layoutMasonry } from './receiptSplitImageLayout';

describe('layoutMasonry', () => {
  it('puts each card under the shortest column', () => {
    const layout = layoutMasonry([500, 200, 200, 200], 2, 10);
    expect(layout.placements).toEqual([
      { column: 0, y: 0 },
      { column: 1, y: 0 },
      { column: 1, y: 210 },
      { column: 1, y: 420 },
    ]);
    expect(layout.height).toBe(620);
  });

  it('has no height without cards', () => {
    expect(layoutMasonry([], 1, 10).height).toBe(0);
  });
});

describe('chooseMasonryLayout', () => {
  const choose = (heights: number[]) =>
    chooseMasonryLayout({
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
    const five = choose(Array.from({ length: 5 }, () => 1000));
    const twelve = choose(Array.from({ length: 12 }, () => 1000));
    expect(five.columns).toBe(3);
    expect(twelve.columns).toBe(4);
  });

  it('never uses more columns than there are people', () => {
    expect(choose([3000, 3000]).columns).toBe(2);
  });
});
