import type {
  BreakdownItemRow,
  BreakdownRow,
  PersonBreakdown,
  PersonBreakdownBody,
  ReceiptBreakdownSection,
  ReceiptBreakdownTotal,
} from '@shared/types/summaryBreakdown';
import { formatConversionLines, formatItemAmount } from '@features/sharing/logic/breakdownFormat';
import { wrapText } from '@features/sharing/logic/canvas/draw';
import { FONT } from '@features/sharing/logic/canvas/theme';

export const COLUMN_WIDTH = 760;
export const CARD_PAD = 28;
export const HEADER_H = 64;
export const HEADER_CONVERSION_H = 30;
const BODY_GAP = 20;

export const SECTION_PAD = 20;
const SECTION_GAP = 12;
const SECTION_TITLE_H = 30;
const CONVERSION_LINE_H = 26;
export const SECTION_RULE_H = 18;
const ITEM_H = 38;
export const ITEM_WRAP_H = 28;
const ITEM_MAX_LINES = 2;
const RULE_H = 14;
const CHARGE_H = 34;
const EMPTY_H = 40;
const RECEIPT_TOTAL_H = 40;

const QR_GAP = 24;
export const QR_SIZE = 240;

export const INNER_WIDTH = COLUMN_WIDTH - CARD_PAD * 2;
export const SECTION_INNER_WIDTH = INNER_WIDTH - SECTION_PAD * 2;

export interface Placed<T> {
  item: T;
  /** From the top of whatever the item sits in. */
  y: number;
  height: number;
}

interface Stack<T> {
  placed: Placed<T>[];
  bottom: number;
}

/** Places items one under the next from `top`, `gap` apart. */
function stack<T>(items: T[], top: number, heightOf: (item: T) => number, gap = 0): Stack<T> {
  let y = top;
  const placed = items.map((item, index) => {
    if (index > 0) y += gap;
    const height = heightOf(item);
    const position = { item, y, height };
    y += height;
    return position;
  });
  return { placed, bottom: y };
}

export interface SectionLayout {
  section: ReceiptBreakdownSection;
  conversionLines: Placed<string>[];
  /** Top of the rule under the section's heading. */
  ruleY: number;
  rows: Placed<BreakdownRow>[];
  height: number;
}

export type BodyLayout =
  | { kind: 'receiptTotals'; totals: Placed<ReceiptBreakdownTotal>[]; height: number }
  | { kind: 'sections'; sections: Placed<SectionLayout>[]; height: number }
  | { kind: 'empty'; message: string; height: number };

export interface CardLayout {
  breakdown: PersonBreakdown;
  /** Top of the body, under the header. */
  bodyTop: number;
  body: BodyLayout;
  /** What the card needs; a card in a row of taller ones is drawn at the row's height. */
  height: number;
}

/**
 * Where everything in a person's card goes. The image is sized from this and drawn from this,
 * so the two cannot disagree about what a card holds.
 */
export function layoutCard(ctx: CanvasRenderingContext2D, breakdown: PersonBreakdown): CardLayout {
  const bodyTop = CARD_PAD + HEADER_H + (breakdown.conversion ? HEADER_CONVERSION_H : 0) + BODY_GAP;
  const body = layoutBody(ctx, breakdown.body);
  const qrHeight = breakdown.qrDataUrl ? QR_GAP + QR_SIZE : 0;
  return { breakdown, bodyTop, body, height: bodyTop + body.height + qrHeight + CARD_PAD };
}

function layoutBody(ctx: CanvasRenderingContext2D, body: PersonBreakdownBody): BodyLayout {
  switch (body.kind) {
    case 'receiptTotals': {
      const totals = stack(body.totals, 0, () => RECEIPT_TOTAL_H);
      return { kind: 'receiptTotals', totals: totals.placed, height: totals.bottom };
    }
    case 'sections': {
      const layouts = body.sections.map((section) => layoutSection(ctx, section));
      const sections = stack(layouts, 0, (layout) => layout.height, SECTION_GAP);
      return { kind: 'sections', sections: sections.placed, height: sections.bottom };
    }
    case 'empty':
      return { kind: 'empty', message: body.message, height: EMPTY_H };
  }
}

function layoutSection(
  ctx: CanvasRenderingContext2D,
  section: ReceiptBreakdownSection,
): SectionLayout {
  const conversionLines = stack(
    section.conversion ? formatConversionLines(section.conversion) : [],
    SECTION_PAD + SECTION_TITLE_H,
    () => CONVERSION_LINE_H,
  );
  const ruleY = conversionLines.bottom;
  const rows = stack(section.rows, ruleY + SECTION_RULE_H, (row) => rowHeight(ctx, row));
  return {
    section,
    conversionLines: conversionLines.placed,
    ruleY,
    rows: rows.placed,
    height: rows.bottom + SECTION_PAD,
  };
}

function rowHeight(ctx: CanvasRenderingContext2D, row: BreakdownRow): number {
  switch (row.kind) {
    case 'item':
      return ITEM_H + (itemLabelLines(ctx, row).length - 1) * ITEM_WRAP_H;
    case 'rule':
      return RULE_H;
    case 'charge':
      return CHARGE_H;
    case 'empty':
      return EMPTY_H;
  }
}

/** Long item names wrap onto a second line rather than losing the part that tells items apart. */
export function itemLabelLines(ctx: CanvasRenderingContext2D, row: BreakdownItemRow): string[] {
  ctx.font = `500 22px ${FONT}`;
  const valueWidth = ctx.measureText(formatItemAmount(row)).width;
  ctx.font = `400 22px ${FONT}`;
  return wrapText(ctx, row.label, SECTION_INNER_WIDTH - valueWidth - 24, ITEM_MAX_LINES);
}
