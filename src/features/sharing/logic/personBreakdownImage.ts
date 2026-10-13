import { formatCurrencyFromCents } from '@shared/logic/core/money';
import type {
  BreakdownChargeRow,
  BreakdownItemRow,
  PersonBreakdown,
  ReceiptBreakdownSection,
  SummaryBreakdown,
} from '@shared/types/summaryBreakdown';
import { loadImage } from '@shared/utils/loadImage';
import { formatConversionLines, formatRateLine } from '@features/sharing/logic/breakdownFormat';
import {
  canvasToBlob,
  drawCardShell,
  drawPersonAvatar,
  drawRoundedRect,
  drawTitle,
  ellipsizeText,
  wrapText,
} from '@features/sharing/logic/canvas/draw';
import { FONT, INK, INSET, MUTED, PAGE } from '@features/sharing/logic/canvas/theme';
import { chooseGridLayout } from '@features/sharing/logic/gridLayout';

interface GeneratePersonBreakdownImageOptions {
  summaryBreakdown: SummaryBreakdown;
  includeItemDetails: boolean;
  receiptName?: string;
}

const RULE = 'rgba(202,196,208,0.45)';

const PAD = 48;
const COLUMN_WIDTH = 760;
const COLUMN_GAP = 24;
const MAX_COLUMNS = 4;
const TITLE_H = 96;
const BAND_H = 112;
const BAND_AFTER_GAP = 28;

const CARD_PAD = 28;
const AVATAR_RADIUS = 24;
const HEADER_H = 64;
const HEADER_CONVERSION_H = 30;
const BODY_GAP = 20;

const SECTION_PAD = 20;
const SECTION_GAP = 12;
const SECTION_TITLE_H = 30;
const CONVERSION_LINE_H = 26;
const SECTION_RULE_H = 18;
const ITEM_H = 38;
const ITEM_WRAP_H = 28;
const ITEM_MAX_LINES = 2;
const CHARGE_RULE_H = 14;
const CHARGE_H = 34;
const EMPTY_H = 40;
const COLLAPSED_ROW_H = 40;

const QR_GAP = 24;
const QR_SIZE = 240;

export async function generatePersonBreakdownImage(
  options: GeneratePersonBreakdownImageOptions,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to initialize canvas renderer.');

  const { summaryBreakdown, includeItemDetails } = options;
  const people = summaryBreakdown.personBreakdowns;
  const qrImages = await preloadQrImages(summaryBreakdown);
  const cardHeights = people.map((person) =>
    measurePersonCard(ctx, person, includeItemDetails, qrImages.has(person.person.id)),
  );

  const bodyTop = PAD + TITLE_H + BAND_H + BAND_AFTER_GAP;
  const heightFor = (bodyHeight: number) => bodyTop + bodyHeight + PAD;
  const layout = chooseGridLayout({
    heights: cardHeights,
    maxColumns: MAX_COLUMNS,
    gap: COLUMN_GAP,
    widthFor: canvasWidthFor,
    heightFor,
  });

  // Resizing clears the canvas and its state, so it happens once the measuring is done.
  canvas.width = canvasWidthFor(layout.columns);
  canvas.height = heightFor(layout.height);

  ctx.fillStyle = PAGE;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const contentWidth = canvas.width - PAD * 2;
  drawTitle(ctx, options.receiptName || 'Receipt Splitter', PAD, PAD + 40);
  drawGrandTotalBand(ctx, {
    y: PAD + TITLE_H,
    width: contentWidth,
    summaryBreakdown,
  });

  people.forEach((breakdown, index) => {
    const placement = layout.placements[index];
    drawPersonCard(ctx, {
      x: PAD + placement.column * (COLUMN_WIDTH + COLUMN_GAP),
      y: bodyTop + placement.y,
      height: placement.height,
      breakdown,
      includeItemDetails,
      qrImage: qrImages.get(breakdown.person.id),
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
    summaryBreakdown.personBreakdowns
      .filter((person) => person.qrDataUrl)
      .map(async (person) => [person.person.id, await loadImage(person.qrDataUrl!)] as const),
  );
  return new Map(entries);
}

interface GrandTotalBandArgs {
  y: number;
  width: number;
  summaryBreakdown: SummaryBreakdown;
}

function drawGrandTotalBand(ctx: CanvasRenderingContext2D, args: GrandTotalBandArgs): void {
  ctx.fillStyle = INK;
  drawRoundedRect(ctx, PAD, args.y, args.width, BAND_H, 24);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.70)';
  ctx.font = `700 18px ${FONT}`;
  ctx.fillText(args.summaryBreakdown.totalLabel.toUpperCase(), PAD + CARD_PAD, args.y + 38);

  ctx.fillStyle = '#ffffff';
  ctx.font = `800 48px ${FONT}`;
  ctx.fillText(
    formatCurrencyFromCents(args.summaryBreakdown.totalCents, args.summaryBreakdown.currency),
    PAD + CARD_PAD,
    args.y + 90,
  );

  // Image only: the cards on screen each keep their rate, but side by side in one image
  // the same rate would repeat on every card, so it is said once here.
  const { exchangeRate } = args.summaryBreakdown;
  if (!exchangeRate) return;
  ctx.fillStyle = 'rgba(255,255,255,0.70)';
  ctx.font = `500 20px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(formatRateLine(exchangeRate), PAD + args.width - CARD_PAD, args.y + 90);
  ctx.textAlign = 'left';
}

const INNER_WIDTH = COLUMN_WIDTH - CARD_PAD * 2;
const SECTION_INNER_WIDTH = INNER_WIDTH - SECTION_PAD * 2;

function measurePersonCard(
  ctx: CanvasRenderingContext2D,
  breakdown: PersonBreakdown,
  includeItemDetails: boolean,
  hasQr: boolean,
): number {
  return (
    CARD_PAD +
    measureHeader(breakdown) +
    BODY_GAP +
    measureBody(ctx, breakdown, includeItemDetails) +
    (hasQr ? QR_GAP + QR_SIZE : 0) +
    CARD_PAD
  );
}

function measureHeader(breakdown: PersonBreakdown): number {
  return HEADER_H + (breakdown.conversion ? HEADER_CONVERSION_H : 0);
}

function measureBody(
  ctx: CanvasRenderingContext2D,
  breakdown: PersonBreakdown,
  includeItemDetails: boolean,
): number {
  if (!includeItemDetails) return breakdown.collapsedReceiptTotals.length * COLLAPSED_ROW_H;
  if (breakdown.sections.length === 0) return breakdown.emptyMessage ? EMPTY_H : 0;
  return breakdown.sections.reduce(
    (height, section, index) =>
      height + (index > 0 ? SECTION_GAP : 0) + measureSection(ctx, section),
    0,
  );
}

function measureSection(ctx: CanvasRenderingContext2D, section: ReceiptBreakdownSection): number {
  const conversionH = section.conversion
    ? formatConversionLines(section.conversion).length * CONVERSION_LINE_H
    : 0;
  const itemsH = section.emptyMessage
    ? EMPTY_H
    : section.itemRows.reduce((height, row) => height + measureItemRow(ctx, row), 0);
  const chargesH =
    section.chargeRows.length > 0 ? CHARGE_RULE_H + section.chargeRows.length * CHARGE_H : 0;
  return (
    SECTION_PAD + SECTION_TITLE_H + conversionH + SECTION_RULE_H + itemsH + chargesH + SECTION_PAD
  );
}

function measureItemRow(ctx: CanvasRenderingContext2D, row: BreakdownItemRow): number {
  return ITEM_H + (itemLabelLines(ctx, row).length - 1) * ITEM_WRAP_H;
}

/** Long item names wrap onto a second line rather than losing the part that tells items apart. */
function itemLabelLines(ctx: CanvasRenderingContext2D, row: BreakdownItemRow): string[] {
  ctx.font = `500 22px ${FONT}`;
  const valueWidth = ctx.measureText(formatItemAmount(row)).width;
  ctx.font = `400 22px ${FONT}`;
  return wrapText(ctx, row.label, SECTION_INNER_WIDTH - valueWidth - 24, ITEM_MAX_LINES);
}

interface PersonCardArgs {
  x: number;
  y: number;
  height: number;
  breakdown: PersonBreakdown;
  includeItemDetails: boolean;
  qrImage?: HTMLImageElement;
}

function drawPersonCard(ctx: CanvasRenderingContext2D, args: PersonCardArgs): void {
  const { breakdown } = args;
  drawCardShell(ctx, args.x, args.y, COLUMN_WIDTH, args.height);

  const innerX = args.x + CARD_PAD;
  drawPersonHeader(ctx, breakdown, innerX, args.y + CARD_PAD);

  let y = args.y + CARD_PAD + measureHeader(breakdown) + BODY_GAP;
  if (!args.includeItemDetails) {
    for (const total of breakdown.collapsedReceiptTotals) {
      drawAmountRow(ctx, {
        x: innerX,
        y: y + 28,
        width: INNER_WIDTH,
        label: total.label,
        value: formatCurrencyFromCents(total.totalCents, total.currency),
        font: `400 22px ${FONT}`,
        valueFont: `500 22px ${FONT}`,
      });
      y += COLLAPSED_ROW_H;
    }
  } else if (breakdown.sections.length === 0 && breakdown.emptyMessage) {
    drawEmptyMessage(ctx, breakdown.emptyMessage, innerX, y);
  } else {
    breakdown.sections.forEach((section, index) => {
      if (index > 0) y += SECTION_GAP;
      const height = measureSection(ctx, section);
      drawSection(ctx, section, innerX, y, height);
      y += height;
    });
  }

  if (args.qrImage) {
    drawPaynowQr(ctx, args.qrImage, innerX, args.y + args.height - CARD_PAD - QR_SIZE);
  }
}

function drawPersonHeader(
  ctx: CanvasRenderingContext2D,
  breakdown: PersonBreakdown,
  x: number,
  y: number,
): void {
  const right = x + INNER_WIDTH;
  const total = formatCurrencyFromCents(breakdown.totalCents, breakdown.currency);
  const conversion = breakdown.conversion
    ? `≈ ${formatCurrencyFromCents(breakdown.conversion.amountCents, breakdown.conversion.toCurrency)}`
    : null;

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
  if (conversion) {
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

  const nameX = x + AVATAR_RADIUS * 2 + 14;
  const nameWidth = right - nameX - Math.max(labelWidth, totalWidth, conversionWidth) - 20;
  ctx.fillStyle = INK;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText(ellipsizeText(ctx, breakdown.person.name, nameWidth), nameX, y + 45);
}

function drawSection(
  ctx: CanvasRenderingContext2D,
  section: ReceiptBreakdownSection,
  x: number,
  y: number,
  height: number,
): void {
  ctx.fillStyle = INSET;
  drawRoundedRect(ctx, x, y, INNER_WIDTH, height, 14);
  ctx.fill();

  const innerX = x + SECTION_PAD;
  const right = innerX + SECTION_INNER_WIDTH;
  let rowY = y + SECTION_PAD;

  drawAmountRow(ctx, {
    x: innerX,
    y: rowY + 22,
    width: SECTION_INNER_WIDTH,
    label: section.title,
    value: formatCurrencyFromCents(section.totalCents, section.currency),
    font: `700 22px ${FONT}`,
    valueFont: `700 22px ${FONT}`,
    labelColor: INK,
  });
  rowY += SECTION_TITLE_H;

  if (section.conversion) {
    ctx.fillStyle = MUTED;
    ctx.font = `400 18px ${FONT}`;
    ctx.textAlign = 'right';
    for (const line of formatConversionLines(section.conversion)) {
      ctx.fillText(line, right, rowY + 18);
      rowY += CONVERSION_LINE_H;
    }
    ctx.textAlign = 'left';
  }

  drawRule(ctx, innerX, rowY + SECTION_RULE_H / 2, SECTION_INNER_WIDTH);
  rowY += SECTION_RULE_H;

  if (section.emptyMessage) {
    drawEmptyMessage(ctx, section.emptyMessage, innerX, rowY);
    rowY += EMPTY_H;
  } else {
    for (const row of section.itemRows) {
      drawItemRow(ctx, row, innerX, rowY);
      rowY += measureItemRow(ctx, row);
    }
  }

  if (section.chargeRows.length === 0) return;
  drawRule(ctx, innerX, rowY + CHARGE_RULE_H / 2, SECTION_INNER_WIDTH);
  rowY += CHARGE_RULE_H;
  for (const row of section.chargeRows) {
    drawChargeRow(ctx, row, innerX, rowY);
    rowY += CHARGE_H;
  }
}

function formatItemAmount(row: BreakdownItemRow): string {
  return row.amountCents !== null ? formatCurrencyFromCents(row.amountCents, row.currency) : '—';
}

function drawItemRow(ctx: CanvasRenderingContext2D, row: BreakdownItemRow, x: number, y: number) {
  const lines = itemLabelLines(ctx, row);
  const style = row.involved ? '' : 'italic ';
  ctx.save();
  if (!row.involved) ctx.globalAlpha = 0.4;
  ctx.fillStyle = INK;
  ctx.font = `${style}400 22px ${FONT}`;
  lines.forEach((line, index) => ctx.fillText(line, x, y + 27 + index * ITEM_WRAP_H));

  ctx.font = `${style}500 22px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(formatItemAmount(row), x + SECTION_INNER_WIDTH, y + 27);
  ctx.restore();
}

function drawChargeRow(
  ctx: CanvasRenderingContext2D,
  row: BreakdownChargeRow,
  x: number,
  y: number,
) {
  const sign = row.sign === 'minus' ? '−' : '+';
  drawAmountRow(ctx, {
    x,
    y: y + 25,
    width: SECTION_INNER_WIDTH,
    label: row.label,
    value: `${sign}${formatCurrencyFromCents(row.amountCents, row.currency)}`,
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

function drawRule(ctx: CanvasRenderingContext2D, x: number, y: number, width: number): void {
  ctx.fillStyle = RULE;
  ctx.fillRect(x, Math.round(y), width, 1);
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
