import { formatCurrencyFromCents } from '@shared/logic/core/money';
import type {
  BreakdownChargeRow,
  BreakdownItemRow,
  BreakdownRow,
  PersonBreakdown,
  ReceiptBreakdownTotal,
  SummaryBreakdown,
} from '@features/split-workspace/summary/breakdown/types';
import { loadImage } from '@shared/utils/loadImage';
import {
  formatChargeAmount,
  formatConversionAmount,
  formatItemAmount,
  formatRateLine,
} from '@features/split-workspace/summary/breakdown/breakdownFormat';
import {
  canvasToBlob,
  drawCardShell,
  drawPersonAvatar,
  drawRoundedRect,
  drawTitle,
  ellipsizeText,
} from '@features/split-workspace/summary/canvas/draw';
import { FONT, INK, INSET, MUTED, PAGE } from '@features/split-workspace/summary/canvas/theme';
import { chooseGridLayout } from '@features/split-workspace/summary/breakdown/gridLayout';
import {
  CARD_PAD,
  COLUMN_WIDTH,
  HEADER_CONVERSION_H,
  INNER_WIDTH,
  ITEM_WRAP_H,
  QR_SIZE,
  SECTION_INNER_WIDTH,
  SECTION_PAD,
  SECTION_RULE_H,
  itemLabelLines,
  layoutCard,
  type BodyLayout,
  type CardLayout,
  type SectionLayout,
} from '@features/split-workspace/summary/breakdown/personBreakdownLayout';

interface GeneratePersonBreakdownImageOptions {
  summaryBreakdown: SummaryBreakdown;
  receiptName?: string;
}

const RULE = 'rgba(202,196,208,0.45)';

const PAD = 48;
const COLUMN_GAP = 24;
const MAX_COLUMNS = 4;
const TITLE_H = 96;
const BAND_H = 112;
const BAND_AFTER_GAP = 28;
const AVATAR_RADIUS = 24;

// `PersonBreakdownCard.tsx` renders the same breakdown on screen. Where the two look
// different on purpose, a comment at the spot says so and docs/EXPORT-PARITY.md lists it.
export async function generatePersonBreakdownImage({
  summaryBreakdown,
  receiptName,
}: GeneratePersonBreakdownImageOptions): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to initialize canvas renderer.');

  const qrImages = await preloadQrImages(summaryBreakdown);
  const cards = summaryBreakdown.personBreakdowns.map((breakdown) => layoutCard(ctx, breakdown));

  const bodyTop = PAD + TITLE_H + BAND_H + BAND_AFTER_GAP;
  const heightFor = (bodyHeight: number) => bodyTop + bodyHeight + PAD;
  const grid = chooseGridLayout({
    heights: cards.map((card) => card.height),
    maxColumns: MAX_COLUMNS,
    gap: COLUMN_GAP,
    widthFor: canvasWidthFor,
    heightFor,
  });

  // Resizing clears the canvas and its state, so it happens once the measuring is done.
  canvas.width = canvasWidthFor(grid.columns);
  canvas.height = heightFor(grid.height);

  ctx.fillStyle = PAGE;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawTitle(ctx, receiptName || 'Receipt Splitter', PAD, PAD + 40);
  drawGrandTotalBand(ctx, PAD + TITLE_H, canvas.width - PAD * 2, summaryBreakdown);

  cards.forEach((card, index) => {
    const placement = grid.placements[index];
    drawPersonCard(ctx, card, {
      x: PAD + placement.column * (COLUMN_WIDTH + COLUMN_GAP),
      y: bodyTop + placement.y,
      height: placement.height,
      qrImage: qrImages.get(card.breakdown.person.id),
    });
  });

  return canvasToBlob(canvas);
}

function canvasWidthFor(columns: number): number {
  return PAD * 2 + columns * COLUMN_WIDTH + (columns - 1) * COLUMN_GAP;
}

async function preloadQrImages(
  summaryBreakdown: SummaryBreakdown,
): Promise<Map<string, HTMLImageElement>> {
  const entries = await Promise.all(
    summaryBreakdown.personBreakdowns.flatMap(({ person, qrDataUrl }) =>
      qrDataUrl ? [loadImage(qrDataUrl).then((image) => [person.id, image] as const)] : [],
    ),
  );
  return new Map(entries);
}

function drawGrandTotalBand(
  ctx: CanvasRenderingContext2D,
  y: number,
  width: number,
  summaryBreakdown: SummaryBreakdown,
): void {
  ctx.fillStyle = INK;
  drawRoundedRect(ctx, PAD, y, width, BAND_H, 24);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.70)';
  ctx.font = `700 18px ${FONT}`;
  ctx.fillText(summaryBreakdown.totalLabel.toUpperCase(), PAD + CARD_PAD, y + 38);

  ctx.fillStyle = '#ffffff';
  ctx.font = `800 48px ${FONT}`;
  ctx.fillText(
    formatCurrencyFromCents(summaryBreakdown.totalCents, summaryBreakdown.currency),
    PAD + CARD_PAD,
    y + 90,
  );

  // Image only: the cards on screen each keep their rate, but side by side in one image
  // the same rate would repeat on every card, so it is said once here.
  const { exchangeRate } = summaryBreakdown;
  if (!exchangeRate) return;
  ctx.fillStyle = 'rgba(255,255,255,0.70)';
  ctx.font = `500 20px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(formatRateLine(exchangeRate), PAD + width - CARD_PAD, y + 90);
  ctx.textAlign = 'left';
}

interface CardPlacement {
  x: number;
  y: number;
  /** The grid row's height, which is at least what the card needs. */
  height: number;
  qrImage?: HTMLImageElement;
}

function drawPersonCard(
  ctx: CanvasRenderingContext2D,
  card: CardLayout,
  { x, y, height, qrImage }: CardPlacement,
): void {
  drawCardShell(ctx, x, y, COLUMN_WIDTH, height);

  const innerX = x + CARD_PAD;
  drawPersonHeader(ctx, card.breakdown, innerX, y + CARD_PAD);
  drawBody(ctx, card.body, innerX, y + card.bodyTop);
  // Pinned to the bottom of the row, so the codes line up across cards of different lengths.
  if (qrImage) drawPaynowQr(ctx, qrImage, innerX, y + height - CARD_PAD - QR_SIZE);
}

function drawPersonHeader(
  ctx: CanvasRenderingContext2D,
  breakdown: PersonBreakdown,
  x: number,
  y: number,
): void {
  const right = x + INNER_WIDTH;
  const total = formatCurrencyFromCents(breakdown.totalCents, breakdown.currency);

  ctx.textAlign = 'right';
  ctx.fillStyle = MUTED;
  ctx.font = `500 18px ${FONT}`;
  ctx.fillText(breakdown.headerLabel, right, y + 18);
  const labelWidth = ctx.measureText(breakdown.headerLabel).width;

  ctx.fillStyle = INK;
  ctx.font = `700 36px ${FONT}`;
  ctx.fillText(total, right, y + 56);
  const totalWidth = ctx.measureText(total).width;

  let conversionWidth = 0;
  if (breakdown.conversion) {
    // Image only: the header gives the converted amount and leaves the rate to the band above.
    const conversion = formatConversionAmount(breakdown.conversion);
    ctx.fillStyle = MUTED;
    ctx.font = `500 22px ${FONT}`;
    ctx.fillText(conversion, right, y + 56 + HEADER_CONVERSION_H);
    conversionWidth = ctx.measureText(conversion).width;
  }
  ctx.textAlign = 'left';

  drawPersonAvatar(ctx, {
    cx: x + AVATAR_RADIUS,
    cy: y + 34,
    radius: AVATAR_RADIUS,
    name: breakdown.person.name,
    colorIndex: breakdown.colorIndex,
  });

  // Image only: the card is a fixed width, so a long name is cut short where the screen wraps.
  const nameX = x + AVATAR_RADIUS * 2 + 14;
  const nameWidth = right - nameX - Math.max(labelWidth, totalWidth, conversionWidth) - 20;
  ctx.fillStyle = INK;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText(ellipsizeText(ctx, breakdown.person.name, nameWidth), nameX, y + 45);
}

function drawBody(ctx: CanvasRenderingContext2D, body: BodyLayout, x: number, y: number): void {
  switch (body.kind) {
    case 'receiptTotals':
      for (const total of body.totals) drawReceiptTotal(ctx, total.item, x, y + total.y);
      return;
    case 'sections':
      for (const section of body.sections) drawSection(ctx, section.item, x, y + section.y);
      return;
    case 'empty':
      drawEmptyMessage(ctx, body.message, x, y);
      return;
  }
}

function drawReceiptTotal(
  ctx: CanvasRenderingContext2D,
  total: ReceiptBreakdownTotal,
  x: number,
  y: number,
): void {
  drawAmountRow(ctx, {
    x,
    y: y + 28,
    width: INNER_WIDTH,
    label: total.label,
    value: formatCurrencyFromCents(total.totalCents, total.currency),
    font: `400 22px ${FONT}`,
    valueFont: `500 22px ${FONT}`,
  });
}

function drawSection(
  ctx: CanvasRenderingContext2D,
  { section, conversionLines, ruleY, rows, height }: SectionLayout,
  x: number,
  y: number,
): void {
  ctx.fillStyle = INSET;
  drawRoundedRect(ctx, x, y, INNER_WIDTH, height, 14);
  ctx.fill();

  const innerX = x + SECTION_PAD;
  drawAmountRow(ctx, {
    x: innerX,
    y: y + SECTION_PAD + 22,
    width: SECTION_INNER_WIDTH,
    label: section.title,
    value: formatCurrencyFromCents(section.totalCents, section.currency),
    font: `700 22px ${FONT}`,
    valueFont: `700 22px ${FONT}`,
    labelColor: INK,
  });

  ctx.fillStyle = MUTED;
  ctx.font = `400 18px ${FONT}`;
  ctx.textAlign = 'right';
  for (const line of conversionLines) {
    ctx.fillText(line.item, innerX + SECTION_INNER_WIDTH, y + line.y + 18);
  }
  ctx.textAlign = 'left';

  drawRule(ctx, innerX, y + ruleY + SECTION_RULE_H / 2);
  for (const row of rows) drawRow(ctx, row.item, innerX, y + row.y, row.height);
}

function drawRow(
  ctx: CanvasRenderingContext2D,
  row: BreakdownRow,
  x: number,
  y: number,
  height: number,
): void {
  switch (row.kind) {
    case 'item':
      drawItemRow(ctx, row, x, y);
      return;
    case 'rule':
      drawRule(ctx, x, y + height / 2);
      return;
    case 'charge':
      drawChargeRow(ctx, row, x, y);
      return;
    case 'empty':
      drawEmptyMessage(ctx, row.message, x, y);
      return;
  }
}

function drawItemRow(ctx: CanvasRenderingContext2D, row: BreakdownItemRow, x: number, y: number) {
  const lines = itemLabelLines(ctx, row);
  const involved = row.amountCents !== null;
  const style = involved ? '' : 'italic ';
  ctx.save();
  if (!involved) ctx.globalAlpha = 0.4;
  ctx.fillStyle = INK;
  ctx.font = `${style}400 22px ${FONT}`;
  lines.forEach((line, index) => ctx.fillText(line, x, y + 27 + index * ITEM_WRAP_H));

  ctx.font = `${style}500 22px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(formatItemAmount(row), x + SECTION_INNER_WIDTH, y + 27);
  ctx.restore();
}

// Image only: charges are upright with a green discount, where the screen sets every charge
// in grey italics. The difference is on record in docs/EXPORT-PARITY.md.
function drawChargeRow(
  ctx: CanvasRenderingContext2D,
  row: BreakdownChargeRow,
  x: number,
  y: number,
) {
  drawAmountRow(ctx, {
    x,
    y: y + 25,
    width: SECTION_INNER_WIDTH,
    label: row.label,
    value: formatChargeAmount(row),
    font: `400 20px ${FONT}`,
    valueFont: `400 20px ${FONT}`,
    valueColor: row.sign === 'minus' ? '#16a34a' : MUTED,
  });
}

interface AmountRowArgs {
  x: number;
  y: number;
  width: number;
  label: string;
  value: string;
  font: string;
  valueFont: string;
  labelColor?: string;
  valueColor?: string;
}

function drawAmountRow(ctx: CanvasRenderingContext2D, args: AmountRowArgs): void {
  ctx.font = args.valueFont;
  ctx.fillStyle = args.valueColor ?? INK;
  ctx.textAlign = 'right';
  ctx.fillText(args.value, args.x + args.width, args.y);
  const valueWidth = ctx.measureText(args.value).width;
  ctx.textAlign = 'left';

  ctx.font = args.font;
  ctx.fillStyle = args.labelColor ?? MUTED;
  ctx.fillText(ellipsizeText(ctx, args.label, args.width - valueWidth - 20), args.x, args.y);
}

function drawEmptyMessage(ctx: CanvasRenderingContext2D, message: string, x: number, y: number) {
  ctx.fillStyle = MUTED;
  ctx.font = `italic 400 20px ${FONT}`;
  ctx.fillText(message, x, y + 28);
}

function drawRule(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = RULE;
  ctx.fillRect(x, Math.round(y), SECTION_INNER_WIDTH, 1);
}

/** The image already carries "Pay to" and "Amount" beside the code, so it only needs scaling. */
function drawPaynowQr(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
): void {
  const scale = Math.min(QR_SIZE / image.naturalHeight, INNER_WIDTH / image.naturalWidth);
  ctx.save();
  // Keeps the modules crisp when a low-density code is scaled up.
  ctx.imageSmoothingEnabled = scale <= 1;
  ctx.drawImage(image, x, y, image.naturalWidth * scale, image.naturalHeight * scale);
  ctx.restore();
}
