import type {
  OverviewRow,
  SummaryOverview,
} from '@features/split-workspace/summary/overview/types';

export const PAD = 56;
export const TITLE_H = 76;
export const TITLE_AFTER_GAP = 32;
export const CARD_PAD_X = 32;
export const ITEM_COL_W = 480;
export const PERSON_COL_W = 180;
export const MIN_WIDTH = 1200;
export const HEADER_H = 112;
export const FOOTER_H = 96;
export const ROW_HEIGHTS = {
  heading: 52,
  item: 76,
  charge: 68,
  sectionTotal: 76,
} as const satisfies Record<OverviewRow['kind'], number>;

export function measureOverviewImage(overview: SummaryOverview) {
  const rows = overview.sections.flatMap((section) => section.rows);
  const tableWidth = ITEM_COL_W + overview.people.length * PERSON_COL_W + CARD_PAD_X * 2;
  const bodyHeight = rows.reduce((height, row) => height + ROW_HEIGHTS[row.kind], 0);
  return {
    rows,
    width: Math.max(MIN_WIDTH, tableWidth + PAD * 2),
    height: PAD + TITLE_H + TITLE_AFTER_GAP + HEADER_H + bodyHeight + FOOTER_H + PAD,
  };
}
