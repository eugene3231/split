import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { personColor } from '@shared/utils/personColors';
import type {
  OverviewRow,
  SummaryOverview,
} from '@features/split-workspace/summary/overview/types';
import {
  canvasToBlob,
  drawCardShell,
  drawPersonAvatar,
  drawRoundedRect,
  drawTitle,
  ellipsizeText,
} from '@features/split-workspace/summary/canvas/draw';
import { FONT, INK, INSET, MUTED, PAGE } from '@features/split-workspace/summary/canvas/theme';
import {
  CARD_PAD_X,
  FOOTER_H,
  HEADER_H,
  ITEM_COL_W,
  PAD,
  PERSON_COL_W,
  ROW_HEIGHTS,
  TITLE_AFTER_GAP,
  TITLE_H,
  measureOverviewImage,
} from '@features/split-workspace/summary/overview/overviewLayout';
import type { CurrencyCode } from '@shared/constants';

const DIVIDER = 'rgba(202,196,208,0.40)';

interface GenerateOverviewImageOptions {
  overview: SummaryOverview;
  title?: string;
}

export async function generateOverviewImage({
  overview,
  title,
}: GenerateOverviewImageOptions): Promise<Blob> {
  const { rows, width, height } = measureOverviewImage(overview);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to initialize canvas renderer.');

  ctx.fillStyle = PAGE;
  ctx.fillRect(0, 0, width, height);

  drawTitle(ctx, title || 'Who had what', PAD, PAD + 36);

  const cardY = PAD + TITLE_H + TITLE_AFTER_GAP;
  const cardWidth = width - PAD * 2;
  drawCardShell(ctx, PAD, cardY, cardWidth, height - cardY - PAD);

  const table: TableGeometry = {
    left: PAD + CARD_PAD_X,
    right: PAD + cardWidth - CARD_PAD_X,
    columnRight: (index) => PAD + CARD_PAD_X + ITEM_COL_W + PERSON_COL_W * (index + 1) - CELL_INSET,
  };

  let y = cardY;
  drawHeader(ctx, table, overview, y);
  y += HEADER_H;

  for (const row of rows) {
    const rowHeight = ROW_HEIGHTS[row.kind];
    drawRow(ctx, table, overview, row, y, rowHeight);
    y += rowHeight;
  }

  drawFooter(ctx, table, overview, y);
  return canvasToBlob(canvas);
}

/** Space between a column's right edge and the amounts in it. */
const CELL_INSET = 20;
const PILL_PAD_X = 12;

interface TableGeometry {
  left: number;
  right: number;
  /** Where every amount in a person's column ends, like the right-aligned columns on screen. */
  columnRight: (personIndex: number) => number;
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  table: TableGeometry,
  overview: SummaryOverview,
  y: number,
) {
  ctx.fillStyle = MUTED;
  ctx.font = `500 20px ${FONT}`;
  ctx.fillText('Item', table.left, y + 68);

  overview.people.forEach((person, index) => {
    const right = table.columnRight(index);
    drawPersonAvatar(ctx, {
      cx: right - 22,
      cy: y + 40,
      radius: 22,
      name: person.name,
      colorIndex: index,
    });
    ctx.fillStyle = INK;
    ctx.font = `600 18px ${FONT}`;
    drawRight(ctx, person.name.trim().split(/\s+/)[0] ?? '', right, y + 92);
  });

  drawDivider(ctx, table, y + HEADER_H);
}

function drawRow(
  ctx: CanvasRenderingContext2D,
  table: TableGeometry,
  overview: SummaryOverview,
  row: OverviewRow,
  y: number,
  rowHeight: number,
): void {
  const labelWidth = ITEM_COL_W - 24;

  switch (row.kind) {
    case 'heading':
      ctx.fillStyle = INSET;
      ctx.fillRect(
        table.left - CARD_PAD_X,
        y,
        table.right - table.left + CARD_PAD_X * 2,
        rowHeight,
      );
      ctx.fillStyle = MUTED;
      ctx.font = `600 20px ${FONT}`;
      ctx.fillText(ellipsizeText(ctx, row.title, labelWidth), table.left, y + 33);
      return;

    case 'item':
      drawTwoLineLabel(ctx, {
        x: table.left,
        y,
        width: labelWidth,
        label: row.name,
        detail: formatCurrencyFromCents(row.priceCents, row.currency),
        font: `500 22px ${FONT}`,
      });
      overview.people.forEach((person, index) => {
        const cents = row.sharesByPerson[person.id];
        if (cents === undefined) return;
        drawSharePill(ctx, table.columnRight(index), y + rowHeight / 2, cents, row.currency, index);
      });
      drawDivider(ctx, table, y + rowHeight);
      return;

    case 'charge': {
      const sign = row.sign === 'minus' ? '−' : '';
      drawTwoLineLabel(ctx, {
        x: table.left,
        y,
        width: labelWidth,
        label: row.label,
        detail: `${sign}${formatCurrencyFromCents(row.totalCents, row.currency)}`,
        font: `400 20px ${FONT}`,
      });
      ctx.fillStyle = MUTED;
      ctx.font = `400 18px ${FONT}`;
      overview.people.forEach((person, index) => {
        const cents = row.sharesByPerson[person.id];
        if (cents === undefined) return;
        drawRight(
          ctx,
          `${sign}${formatCurrencyFromCents(cents, row.currency)}`,
          table.columnRight(index),
          y + rowHeight / 2 + 6,
        );
      });
      drawDivider(ctx, table, y + rowHeight);
      return;
    }

    case 'sectionTotal':
      drawTwoLineLabel(ctx, {
        x: table.left,
        y,
        width: labelWidth,
        label: row.label,
        detail: formatCurrencyFromCents(row.totalCents, row.currency),
        font: `600 20px ${FONT}`,
      });
      ctx.fillStyle = INK;
      ctx.font = `600 18px ${FONT}`;
      overview.people.forEach((person, index) => {
        drawRight(
          ctx,
          formatCurrencyFromCents(row.totalByPersonCents[person.id] ?? 0, row.currency),
          table.columnRight(index),
          y + rowHeight / 2 + 6,
        );
      });
      drawDivider(ctx, table, y + rowHeight);
      return;

    default:
      row satisfies never;
  }
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  table: TableGeometry,
  overview: SummaryOverview,
  y: number,
) {
  ctx.fillStyle = INK;
  ctx.fillRect(table.left, y, table.right - table.left, 3);

  drawTwoLineLabel(ctx, {
    x: table.left,
    y,
    width: ITEM_COL_W - 24,
    label: 'Owes',
    detail: `of ${formatCurrencyFromCents(overview.totalCents, overview.currency)}`,
    font: `700 24px ${FONT}`,
  });

  ctx.fillStyle = INK;
  ctx.font = `700 22px ${FONT}`;
  overview.people.forEach((person, index) => {
    drawRight(
      ctx,
      formatCurrencyFromCents(overview.totalByPersonCents[person.id] ?? 0, overview.currency),
      table.columnRight(index),
      y + FOOTER_H / 2 + 8,
    );
  });
}

interface TwoLineLabelArgs {
  x: number;
  y: number;
  width: number;
  label: string;
  detail: string;
  font: string;
}

function drawTwoLineLabel(ctx: CanvasRenderingContext2D, args: TwoLineLabelArgs) {
  ctx.fillStyle = INK;
  ctx.font = args.font;
  ctx.fillText(ellipsizeText(ctx, args.label, args.width), args.x, args.y + 32);
  ctx.fillStyle = MUTED;
  ctx.font = `400 18px ${FONT}`;
  ctx.fillText(ellipsizeText(ctx, args.detail, args.width), args.x, args.y + 58);
}

/** The pill reaches past the column's right edge by its own padding, so its figure meets it. */
function drawSharePill(
  ctx: CanvasRenderingContext2D,
  right: number,
  cy: number,
  cents: number,
  currency: CurrencyCode,
  colorIndex: number,
) {
  const text = formatCurrencyFromCents(cents, currency);
  ctx.font = `600 18px ${FONT}`;
  const width = Math.min(PERSON_COL_W - 12, ctx.measureText(text).width + PILL_PAD_X * 2);
  // Matches the 12% tint of the person's colour behind each share in OverviewTable.
  ctx.fillStyle = `${personColor(colorIndex)}1f`;
  drawRoundedRect(ctx, right + PILL_PAD_X - width, cy - 18, width, 36, 8);
  ctx.fill();
  ctx.fillStyle = INK;
  drawRight(ctx, text, right, cy + 6);
}

function drawRight(ctx: CanvasRenderingContext2D, text: string, right: number, y: number) {
  ctx.textAlign = 'right';
  ctx.fillText(ellipsizeText(ctx, text, PERSON_COL_W - 2 * CELL_INSET), right, y);
  ctx.textAlign = 'left';
}

function drawDivider(ctx: CanvasRenderingContext2D, table: TableGeometry, y: number) {
  ctx.fillStyle = DIVIDER;
  ctx.fillRect(table.left, y - 1, table.right - table.left, 1);
}
