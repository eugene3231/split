import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { personColor } from '@shared/utils/personColors';
import type {
  OverviewChargeRow,
  OverviewItemRow,
  OverviewReceiptSection,
  SummaryOverview,
} from '@shared/types/summaryOverview';
import {
  canvasToBlob,
  drawLightCardShell,
  drawPersonAvatar,
  drawRoundedRect,
  ellipsizeText,
  formatGeneratedAt,
} from '@features/sharing/logic/receiptSplitImageLightHelpers';

const FONT = 'Inter, system-ui, -apple-system, sans-serif';
const PAD = 56;
const TITLE_H = 76;
const TITLE_AFTER_GAP = 32;
const CARD_PAD_X = 32;
const ITEM_COL_W = 480;
const PERSON_COL_W = 180;
const MIN_WIDTH = 1200;
const HEADER_H = 112;
const FOOTER_H = 96;
const ROW_HEIGHTS = { heading: 52, item: 76, charge: 68, sectionTotal: 76 } as const;

const INK = '#18181b';
const MUTED = '#52525b';
const DIVIDER = 'rgba(202,196,208,0.40)';

export type OverviewImageRow =
  | { kind: 'heading'; section: OverviewReceiptSection }
  | { kind: 'item'; row: OverviewItemRow }
  | { kind: 'charge'; row: OverviewChargeRow; currency: string }
  | { kind: 'sectionTotal'; section: OverviewReceiptSection };

/** The table's body rows in order, matching what `OverviewTable` renders. */
export function buildOverviewImageRows(overview: SummaryOverview): OverviewImageRow[] {
  const showSectionHeadings = overview.sections.length > 1;
  return overview.sections.flatMap((section): OverviewImageRow[] => [
    ...(showSectionHeadings ? [{ kind: 'heading' as const, section }] : []),
    ...section.itemRows.map((row) => ({ kind: 'item' as const, row })),
    ...section.chargeRows.map((row) => ({
      kind: 'charge' as const,
      row,
      currency: section.currency,
    })),
    ...(showSectionHeadings ? [{ kind: 'sectionTotal' as const, section }] : []),
  ]);
}

export function measureOverviewImage(overview: SummaryOverview) {
  const rows = buildOverviewImageRows(overview);
  const tableWidth = ITEM_COL_W + overview.people.length * PERSON_COL_W + CARD_PAD_X * 2;
  const bodyHeight = rows.reduce((height, row) => height + ROW_HEIGHTS[row.kind], 0);
  return {
    rows,
    width: Math.max(MIN_WIDTH, tableWidth + PAD * 2),
    height: PAD + TITLE_H + TITLE_AFTER_GAP + HEADER_H + bodyHeight + FOOTER_H + PAD,
  };
}

interface GenerateOverviewImageOptions {
  overview: SummaryOverview;
  title?: string;
}

export async function generateOverviewTableImage({
  overview,
  title,
}: GenerateOverviewImageOptions): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('Image export is only available in the browser.');
  }

  const { rows, width, height } = measureOverviewImage(overview);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to initialize canvas renderer.');

  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, width, height);

  drawTitle(ctx, overview, title);

  const cardY = PAD + TITLE_H + TITLE_AFTER_GAP;
  const cardWidth = width - PAD * 2;
  drawLightCardShell(ctx, PAD, cardY, cardWidth, height - cardY - PAD);

  const table: TableGeometry = {
    left: PAD + CARD_PAD_X,
    right: PAD + cardWidth - CARD_PAD_X,
    columnCenter: (index) => PAD + CARD_PAD_X + ITEM_COL_W + PERSON_COL_W * (index + 0.5),
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

interface TableGeometry {
  left: number;
  right: number;
  columnCenter: (personIndex: number) => number;
}

function drawTitle(ctx: CanvasRenderingContext2D, overview: SummaryOverview, title?: string) {
  ctx.fillStyle = INK;
  ctx.font = `700 44px ${FONT}`;
  ctx.fillText(title || 'Who had what', PAD, PAD + 36);

  ctx.fillStyle = MUTED;
  ctx.font = `500 22px ${FONT}`;
  const unassigned =
    overview.unassignedItemCount > 0 ? ` · ${overview.unassignedItemCount} unassigned` : '';
  ctx.fillText(`Generated ${formatGeneratedAt(new Date())}${unassigned}`, PAD, PAD + 72);
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
    const cx = table.columnCenter(index);
    drawPersonAvatar(ctx, { cx, cy: y + 40, radius: 22, name: person.name, colorIndex: index });
    ctx.fillStyle = INK;
    ctx.font = `600 18px ${FONT}`;
    ctx.textAlign = 'center';
    const firstName = person.name.trim().split(/\s+/)[0] ?? '';
    ctx.fillText(ellipsizeText(ctx, firstName, PERSON_COL_W - 16), cx, y + 92);
    ctx.textAlign = 'left';
  });

  drawDivider(ctx, table, y + HEADER_H);
}

function drawRow(
  ctx: CanvasRenderingContext2D,
  table: TableGeometry,
  overview: SummaryOverview,
  row: OverviewImageRow,
  y: number,
  rowHeight: number,
) {
  const labelWidth = ITEM_COL_W - 24;

  if (row.kind === 'heading') {
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(table.left - CARD_PAD_X, y, table.right - table.left + CARD_PAD_X * 2, rowHeight);
    ctx.fillStyle = MUTED;
    ctx.font = `700 18px ${FONT}`;
    ctx.fillText(
      ellipsizeText(ctx, row.section.title.toUpperCase(), labelWidth),
      table.left,
      y + 33,
    );
    return;
  }

  if (row.kind === 'item') {
    const { name, priceCents, currency, unassigned, sharesByPerson } = row.row;
    if (unassigned) {
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(
        table.left - CARD_PAD_X,
        y,
        table.right - table.left + CARD_PAD_X * 2,
        rowHeight,
      );
    }
    drawTwoLineLabel(ctx, {
      x: table.left,
      y,
      width: labelWidth,
      label: name,
      detail: `${formatCurrencyFromCents(priceCents, currency)}${unassigned ? ' · nobody yet' : ''}`,
      font: `500 22px ${FONT}`,
    });
    overview.people.forEach((person, index) => {
      const cents = sharesByPerson[person.id];
      if (cents === undefined) return;
      drawSharePill(ctx, table.columnCenter(index), y + rowHeight / 2, cents, currency, index);
    });
    drawDivider(ctx, table, y + rowHeight);
    return;
  }

  if (row.kind === 'charge') {
    const sign = row.row.sign === 'minus' ? '−' : '';
    drawTwoLineLabel(ctx, {
      x: table.left,
      y,
      width: labelWidth,
      label: row.row.label,
      detail: `${sign}${formatCurrencyFromCents(row.row.totalCents, row.currency)}`,
      font: `italic 400 20px ${FONT}`,
    });
    ctx.fillStyle = MUTED;
    ctx.font = `italic 400 18px ${FONT}`;
    overview.people.forEach((person, index) => {
      const cents = row.row.sharesByPerson[person.id];
      if (cents === undefined) return;
      drawCentered(
        ctx,
        `${sign}${formatCurrencyFromCents(cents, row.currency)}`,
        table.columnCenter(index),
        y + rowHeight / 2 + 6,
      );
    });
    drawDivider(ctx, table, y + rowHeight);
    return;
  }

  const { section } = row;
  drawTwoLineLabel(ctx, {
    x: table.left,
    y,
    width: labelWidth,
    label: `${section.title} total`,
    detail: formatCurrencyFromCents(section.totalCents, section.currency),
    font: `600 20px ${FONT}`,
  });
  ctx.fillStyle = INK;
  ctx.font = `600 18px ${FONT}`;
  overview.people.forEach((person, index) => {
    drawCentered(
      ctx,
      formatCurrencyFromCents(section.totalByPersonCents[person.id] ?? 0, section.currency),
      table.columnCenter(index),
      y + rowHeight / 2 + 6,
    );
  });
  drawDivider(ctx, table, y + rowHeight);
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
    drawCentered(
      ctx,
      formatCurrencyFromCents(overview.totalByPersonCents[person.id] ?? 0, overview.currency),
      table.columnCenter(index),
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

function drawSharePill(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cents: number,
  currency: string,
  colorIndex: number,
) {
  const text = formatCurrencyFromCents(cents, currency);
  ctx.font = `600 18px ${FONT}`;
  const width = Math.min(PERSON_COL_W - 12, ctx.measureText(text).width + 24);
  // Matches the 12% tint of the person's colour behind each share in OverviewTable.
  ctx.fillStyle = `${personColor(colorIndex)}1f`;
  drawRoundedRect(ctx, cx - width / 2, cy - 18, width, 36, 8);
  ctx.fill();
  ctx.fillStyle = INK;
  drawCentered(ctx, text, cx, cy + 6);
}

function drawCentered(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number) {
  ctx.textAlign = 'center';
  ctx.fillText(ellipsizeText(ctx, text, PERSON_COL_W - 16), cx, y);
  ctx.textAlign = 'left';
}

function drawDivider(ctx: CanvasRenderingContext2D, table: TableGeometry, y: number) {
  ctx.fillStyle = DIVIDER;
  ctx.fillRect(table.left, y - 1, table.right - table.left, 1);
}
