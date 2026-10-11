export interface GridPlacement {
  column: number;
  y: number;
  /** The row's height, so every card in a row lines up top and bottom. */
  height: number;
}

export interface GridLayout {
  columns: number;
  placements: GridPlacement[];
  height: number;
}

/** Fills rows left to right, top to bottom; each row is as tall as its tallest card. */
export function layoutGrid(heights: number[], columns: number, gap: number): GridLayout {
  const placements: GridPlacement[] = [];
  let y = 0;
  for (let rowStart = 0; rowStart < heights.length; rowStart += columns) {
    const row = heights.slice(rowStart, rowStart + columns);
    const rowHeight = Math.max(...row);
    row.forEach((_, column) => placements.push({ column, y, height: rowHeight }));
    y += rowHeight + gap;
  }
  return { columns, placements, height: Math.max(0, y - gap) };
}

const MIN_GAIN = 0.9;

export interface ColumnChoiceArgs {
  heights: number[];
  maxColumns: number;
  gap: number;
  /** Canvas width for a column count. */
  widthFor: (columns: number) => number;
  /** Canvas height around a grid body of the given height. */
  heightFor: (bodyHeight: number) => number;
}

/**
 * Picks the column count that keeps the image's longest side shortest. Chat apps shrink
 * a shared image to fit a fixed long side, so that is the count with the largest text.
 * Another column has to cut the longest side by a tenth to be worth it: a narrower,
 * taller image suits a phone better.
 */
export function chooseGridLayout({
  heights,
  maxColumns,
  gap,
  widthFor,
  heightFor,
}: ColumnChoiceArgs): GridLayout {
  let best = layoutGrid(heights, 1, gap);
  let bestSide = Math.max(widthFor(1), heightFor(best.height));
  for (let columns = 2; columns <= Math.min(maxColumns, heights.length); columns++) {
    const layout = layoutGrid(heights, columns, gap);
    const side = Math.max(widthFor(columns), heightFor(layout.height));
    if (side < bestSide * MIN_GAIN) {
      best = layout;
      bestSide = side;
    }
  }
  return best;
}
