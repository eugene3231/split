import type { SplitResult } from '@shared/types';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import type {
  BreakdownChargeRow,
  BreakdownItemRow,
  PersonBreakdown,
  ReceiptBreakdownSection,
  SummaryBreakdown,
} from '@shared/types/summaryBreakdown';
import {
  canvasToBlob,
  drawLightCardShell,
  drawPersonAvatar,
  drawRoundedRect,
  ellipsizeText,
  formatConversionLines,
  formatGeneratedAt,
  formatRateLine,
  wrapText,
} from '@features/sharing/logic/receiptSplitImageLightHelpers';
import { chooseGridLayout } from '@features/sharing/logic/receiptSplitImageLayout';

type GenerateReceiptSplitImageLightOptions = {
  summaryBreakdown: SummaryBreakdown;
  split: SplitResult;
  reconciliationCents: number | null;
  includeItemDetails: boolean;
  receiptName?: string;
  currency?: string;
};

const FONT = 'Inter, system-ui, -apple-system, sans-serif';
const INK = '#18181b';
const MUTED = '#52525b';
const RULE = 'rgba(202,196,208,0.45)';

const PAD = 48;
const COLUMN_WIDTH = 760;
const COLUMN_GAP = 24;
const MAX_COLUMNS = 4;
const TITLE_H = 96;
const BAND_H = 112;
const BAND_AFTER_GAP = 28;
const NOTICE_H = 72;
const NOTICE_GAP = 24;

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
const QR_CAPTION_GAP = 16;

export async function generateReceiptSplitImageLight(
  options: GenerateReceiptSplitImageLightOptions,
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('Image export is only available in the browser.');
  }

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
  const noticesH = summaryBreakdown.unassignedItemCount > 0 ? NOTICE_GAP + NOTICE_H : 0;
  const heightFor = (bodyHeight: number) => bodyTop + bodyHeight + noticesH + PAD;
  const layout = chooseGridLayout({
    heights: cardHeights,
    maxColumns: MAX_COLUMNS,
    gap: COLUMN_GAP,
    widthFor: canvasWidthFor,
    heightFor,
  });

  // Resizing clears the canvas and its state, so it happens once the measuring is done.
  canvas.width = canvasWidthFor(layout.columns);
  canvas.height = heightFor(people.length > 0 ? layout.height : NOTICE_H);

  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const contentWidth = canvas.width - PAD * 2;
  drawTitle(ctx, options.receiptName);
  drawGrandTotalBand(ctx, {
    y: PAD + TITLE_H,
    width: contentWidth,
    split: options.split,
    currency: options.currency,
    summaryBreakdown,
  });

  let y = bodyTop;
  if (people.length === 0) {
    drawNotice(
      ctx,
      y,
      contentWidth,
      summaryBreakdown.emptyPeopleMessage ?? 'No people added yet.',
      'card',
    );
    y += NOTICE_H;
  } else {
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
    y += layout.height;
  }

  if (summaryBreakdown.unassignedItemCount > 0) {
    y += NOTICE_GAP;
    drawNotice(
      ctx,
      y,
      contentWidth,
      `${summaryBreakdown.unassignedItemCount} item(s) are unassigned and excluded from totals.`,
      'warning',
    );
  }

  return canvasToBlob(canvas);
}

function canvasWidthFor(columns: number): number {
  return PAD * 2 + columns * COLUMN_WIDTH + (columns - 1) * COLUMN_GAP;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
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

function drawTitle(ctx: CanvasRenderingContext2D, receiptName?: string): void {
  ctx.fillStyle = INK;
  ctx.font = `700 44px ${FONT}`;
  ctx.fillText(receiptName || 'Receipt Splitter', PAD, PAD + 40);

  ctx.fillStyle = MUTED;
  ctx.font = `500 22px ${FONT}`;
  ctx.fillText(`Generated ${formatGeneratedAt(new Date())}`, PAD, PAD + 76);
}

interface GrandTotalBandArgs {
  y: number;
  width: number;
  split: SplitResult;
  currency?: string;
  summaryBreakdown: SummaryBreakdown;
}

function drawGrandTotalBand(ctx: CanvasRenderingContext2D, args: GrandTotalBandArgs): void {
  ctx.fillStyle = INK;
  drawRoundedRect(ctx, PAD, args.y, args.width, BAND_H, 24);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.70)';
  ctx.font = `700 18px ${FONT}`;
  ctx.fillText('GRAND TOTAL', PAD + CARD_PAD, args.y + 38);

  ctx.fillStyle = '#ffffff';
  ctx.font = `800 48px ${FONT}`;
  ctx.fillText(
    formatCurrencyFromCents(args.split.grandTotalCents, args.currency),
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

function drawNotice(
  ctx: CanvasRenderingContext2D,
  y: number,
  width: number,
  message: string,
  tone: 'card' | 'warning',
): void {
  if (tone === 'card') {
    drawLightCardShell(ctx, PAD, y, width, NOTICE_H);
  } else {
    ctx.fillStyle = '#fef3c7';
    drawRoundedRect(ctx, PAD, y, width, NOTICE_H, 16);
    ctx.fill();
  }
  ctx.fillStyle = tone === 'card' ? MUTED : '#92400e';
  ctx.font = `500 22px ${FONT}`;
  ctx.fillText(ellipsizeText(ctx, message, width - CARD_PAD * 2), PAD + CARD_PAD, y + 44);
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
  drawLightCardShell(ctx, args.x, args.y, COLUMN_WIDTH, args.height);

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
    drawPaynowQr(ctx, args.qrImage, args.x, args.y + args.height - CARD_PAD - QR_SIZE);
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
  ctx.fillStyle = '#f0f0f0';
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

/**
 * The PayNow image is the code with its "Pay To / Amount" caption stacked underneath.
 * Drawing the caption beside the code instead lets the code be bigger for the same height.
 */
function drawPaynowQr(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  cardX: number,
  y: number,
): void {
  const codeSide = image.naturalWidth;
  const captionHeight = image.naturalHeight - codeSide;
  const captionDrawHeight = (captionHeight / codeSide) * QR_SIZE;
  const blockWidth = QR_SIZE * 2 + QR_CAPTION_GAP;
  const x = cardX + (COLUMN_WIDTH - blockWidth) / 2;

  ctx.save();
  // Keeps the modules crisp when a low-density code is scaled up.
  ctx.imageSmoothingEnabled = codeSide >= QR_SIZE;
  ctx.drawImage(image, 0, 0, codeSide, codeSide, x, y, QR_SIZE, QR_SIZE);
  ctx.restore();

  if (captionHeight > 0) {
    ctx.drawImage(
      image,
      0,
      codeSide,
      codeSide,
      captionHeight,
      x + QR_SIZE + QR_CAPTION_GAP,
      y + (QR_SIZE - captionDrawHeight) / 2,
      QR_SIZE,
      captionDrawHeight,
    );
  }
}
