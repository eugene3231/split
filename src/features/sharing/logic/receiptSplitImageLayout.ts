export interface MasonryPlacement {
  column: number;
  y: number;
}

export interface MasonryLayout {
  columns: number;
  placements: MasonryPlacement[];
  height: number;
}

/** Drops each card into the shortest column so a short card never leaves a gap under it. */
export function layoutMasonry(heights: number[], columns: number, gap: number): MasonryLayout {
  const columnHeights = Array.from({ length: columns }, () => 0);
  const placements = heights.map((height) => {
    const column = columnHeights.indexOf(Math.min(...columnHeights));
    const y = columnHeights[column];
    columnHeights[column] = y + height + gap;
    return { column, y };
  });
  return {
    columns,
    placements,
    height: Math.max(0, Math.max(...columnHeights) - gap),
  };
}

const MIN_GAIN = 0.9;

export interface ColumnChoiceArgs {
  heights: number[];
  maxColumns: number;
  gap: number;
  /** Canvas width for a column count. */
  widthFor: (columns: number) => number;
  /** Canvas height around a masonry body of the given height. */
  heightFor: (bodyHeight: number) => number;
}

/**
 * Picks the column count that keeps the image's longest side shortest. Chat apps shrink
 * a shared image to fit a fixed long side, so that is the count with the largest text.
 * Another column has to cut the longest side by a tenth to be worth it: a narrower,
 * taller image suits a phone better, and fewer columns leave fewer gaps at the bottom.
 */
export function chooseMasonryLayout({
  heights,
  maxColumns,
  gap,
  widthFor,
  heightFor,
}: ColumnChoiceArgs): MasonryLayout {
  let best = layoutMasonry(heights, 1, gap);
  let bestSide = Math.max(widthFor(1), heightFor(best.height));
  for (let columns = 2; columns <= Math.min(maxColumns, heights.length); columns++) {
    const layout = layoutMasonry(heights, columns, gap);
    const side = Math.max(widthFor(columns), heightFor(layout.height));
    if (side < bestSide * MIN_GAIN) {
      best = layout;
      bestSide = side;
    }
  }
  return best;
}
