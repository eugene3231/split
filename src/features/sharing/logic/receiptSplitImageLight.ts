import type { SplitResult } from '@shared/types';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import type {
  BreakdownChargeRow,
  BreakdownItemRow,
  PersonBreakdown,
  ReceiptBreakdownSection,
  SummaryBreakdown,
} from '@features/split-workspace/logic/summaryBreakdown';
import {
  CANVAS_WIDTH,
  canvasToBlob,
  drawAvatar,
  drawCurrencyConversionLines,
  drawLightCardShell,
  drawLightTwoColumnRow,
  drawNestedCard,
  drawRoundedRect,
  formatGeneratedAt,
  getPersonLightColor,
} from '@features/sharing/logic/receiptSplitImageLightHelpers';

type GenerateReceiptSplitImageLightOptions = {
  summaryBreakdown: SummaryBreakdown;
  split: SplitResult;
  reconciliationCents: number | null;
  includeItemDetails: boolean;
  receiptName?: string;
  currency?: string;
};

const CANVAS_PADDING = 56;
const QR_SIZE = 160;
const QR_GAP = 20;
const QR_CAPTION_H = 108;
const CARD_PAD = 32;
const AVATAR_RADIUS = 22;
const AVATAR_GAP = 16;
const HEADER_H = 88;
const LINE_ROW_H = 34;
const RECEIPT_LABEL_H = 40;
const CHARGE_ROW_H = 34;
const DIVIDER_H = 22;
const BODY_TOP_PAD = 16;
const BETWEEN_CARD_GAP = 20;
const GRAND_TOTAL_CARD_H = 116;
const GRAND_TOTAL_AFTER_GAP = 32;
const RECEIPT_SUB_CARD_PAD = 20;
const RECEIPT_SUB_CARD_GAP = 12;
const CURRENCY_LINE_H = 22;
const RECEIPT_HEADER_SEP_H = 16;
const EMPTY_STATE_H = 40;

function computeRequiredHeight(
  options: GenerateReceiptSplitImageLightOptions,
  cols: number,
): number {
  let y = CANVAS_PADDING + 36 + 40;
  y += GRAND_TOTAL_CARD_H + GRAND_TOTAL_AFTER_GAP;

  const people = options.summaryBreakdown.personBreakdowns;

  if (people.length === 0) {
    y += 72 + BETWEEN_CARD_GAP;
  } else {
    for (let rowStart = 0; rowStart < people.length; rowStart += cols) {
      const rowPeople = people.slice(rowStart, Math.min(rowStart + cols, people.length));
      const rowHeight = rowPeople.reduce(
        (height, person) =>
          Math.max(height, measurePersonBreakdownCardHeight(person, options.includeItemDetails)),
        0,
      );
      y += rowHeight + BETWEEN_CARD_GAP;
    }
  }

  if (options.summaryBreakdown.unassignedItemCount > 0) {
    y += 72 + BETWEEN_CARD_GAP;
  }

  return Math.max(240, Math.ceil(y + CANVAS_PADDING));
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

export async function generateReceiptSplitImageLight(
  options: GenerateReceiptSplitImageLightOptions,
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('Image export is only available in the browser.');
  }

  const people = options.summaryBreakdown.personBreakdowns;
  const COLS = people.length >= 5 ? 3 : 2;
  const canvasWidth = COLS === 3 ? 2700 : CANVAS_WIDTH;

  const scratch = document.createElement('canvas');
  scratch.width = canvasWidth;
  scratch.height = computeRequiredHeight(options, COLS);

  const ctx = scratch.getContext('2d');
  if (!ctx) throw new Error('Unable to initialize canvas renderer.');

  const qrImages = await preloadQrImages(options.summaryBreakdown);

  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, scratch.width, scratch.height);

  let y = CANVAS_PADDING;
  const x = CANVAS_PADDING;
  const cardWidth = canvasWidth - x * 2;

  ctx.fillStyle = '#1c1b1f';
  ctx.font = '700 44px system-ui, -apple-system, sans-serif';
  ctx.fillText(options.receiptName || 'Receipt Splitter', x, y);
  y += 36;

  ctx.fillStyle = '#49454f';
  ctx.font = '500 22px system-ui, -apple-system, sans-serif';
  ctx.fillText(`Generated ${formatGeneratedAt(new Date())}`, x, y);
  y += 40;

  y = drawGrandTotalCard(ctx, {
    x,
    y,
    width: cardWidth,
    split: options.split,
    currency: options.currency,
  });
  y += GRAND_TOTAL_AFTER_GAP;

  if (people.length === 0) {
    drawLightCardShell(ctx, x, y, cardWidth, 72);
    ctx.fillStyle = '#49454f';
    ctx.font = '500 22px system-ui, -apple-system, sans-serif';
    ctx.fillText(
      options.summaryBreakdown.emptyPeopleMessage ?? 'No people added yet.',
      x + CARD_PAD,
      y + 46,
    );
    y += 72 + BETWEEN_CARD_GAP;
  } else {
    const COL_GAP = 24;
    const colWidth = Math.floor((cardWidth - COL_GAP * (COLS - 1)) / COLS);

    for (let rowStart = 0; rowStart < people.length; rowStart += COLS) {
      const rowPeople = people.slice(rowStart, Math.min(rowStart + COLS, people.length));

      const rowHeight = rowPeople.reduce(
        (height, person) =>
          Math.max(height, measurePersonBreakdownCardHeight(person, options.includeItemDetails)),
        0,
      );

      for (let col = 0; col < rowPeople.length; col++) {
        const breakdown = rowPeople[col];
        drawPersonBreakdownCard(ctx, {
          x: x + col * (colWidth + COL_GAP),
          y,
          width: colWidth,
          height: rowHeight,
          breakdown,
          includeLineItems: options.includeItemDetails,
          qrImage: qrImages.get(breakdown.person.id),
        });
      }

      y += rowHeight + BETWEEN_CARD_GAP;
    }
  }

  if (options.summaryBreakdown.unassignedItemCount > 0) {
    const warnH = 72;
    ctx.save();
    ctx.fillStyle = '#fef3c7';
    drawRoundedRect(ctx, x, y, cardWidth, warnH, 16);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#92400e';
    ctx.font = '500 22px system-ui, -apple-system, sans-serif';
    ctx.fillText(
      `${options.summaryBreakdown.unassignedItemCount} item(s) are unassigned and excluded from totals.`,
      x + CARD_PAD,
      y + 44,
    );
    y += warnH + BETWEEN_CARD_GAP;
  }

  const requiredHeight = Math.max(240, Math.ceil(y + CANVAS_PADDING));

  const output = document.createElement('canvas');
  output.width = canvasWidth;
  output.height = requiredHeight;
  const outCtx = output.getContext('2d');
  if (!outCtx) throw new Error('Unable to finalize image export.');
  outCtx.drawImage(scratch, 0, 0, canvasWidth, requiredHeight, 0, 0, output.width, output.height);
  return canvasToBlob(output);
}

type GrandTotalCardArgs = {
  x: number;
  y: number;
  width: number;
  split: SplitResult;
  currency?: string;
};

function drawGrandTotalCard(ctx: CanvasRenderingContext2D, args: GrandTotalCardArgs): number {
  const h = GRAND_TOTAL_CARD_H;

  ctx.save();
  const grad = ctx.createLinearGradient(args.x, args.y, args.x + args.width, args.y);
  grad.addColorStop(0, '#2d6a7f');
  grad.addColorStop(1, '#1e5068');
  ctx.fillStyle = grad;
  drawRoundedRect(ctx, args.x, args.y, args.width, h, 16);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.70)';
  ctx.font = '700 20px system-ui, -apple-system, sans-serif';
  ctx.fillText('GRAND TOTAL', args.x + CARD_PAD, args.y + 36);

  ctx.fillStyle = '#ffffff';
  ctx.font = '600 52px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    formatCurrencyFromCents(args.split.grandTotalCents, args.currency),
    args.x + CARD_PAD,
    args.y + 92,
  );

  return args.y + h;
}

function measureReceiptSectionHeight(
  section: ReceiptBreakdownSection,
  includeLineItems: boolean,
): number {
  const conversionH = section.conversion ? CURRENCY_LINE_H * 2 : 0;
  const detailH = includeLineItems
    ? section.itemRows.length * LINE_ROW_H +
      RECEIPT_HEADER_SEP_H +
      (section.chargeRows.length > 0 ? DIVIDER_H + section.chargeRows.length * CHARGE_ROW_H : 0) +
      (section.emptyMessage ? EMPTY_STATE_H : 0)
    : 0;

  return RECEIPT_SUB_CARD_PAD + RECEIPT_LABEL_H + conversionH + detailH + RECEIPT_SUB_CARD_PAD;
}

function measureCollapsedTotalsHeight(breakdown: PersonBreakdown): number {
  return breakdown.collapsedReceiptTotals.length * LINE_ROW_H;
}

function measurePersonBreakdownCardHeight(
  breakdown: PersonBreakdown,
  includeLineItems: boolean,
): number {
  const effectiveHeaderH = HEADER_H + (breakdown.conversion ? CURRENCY_LINE_H * 2 : 0);

  let bodyH = 0;
  if (includeLineItems) {
    if (breakdown.sections.length > 0) {
      bodyH = breakdown.sections.reduce(
        (sum, section) => sum + measureReceiptSectionHeight(section, true),
        0,
      );
      bodyH += Math.max(0, breakdown.sections.length - 1) * RECEIPT_SUB_CARD_GAP;
    } else if (breakdown.emptyMessage) {
      bodyH = EMPTY_STATE_H;
    }
  } else {
    bodyH = measureCollapsedTotalsHeight(breakdown);
  }

  const qrBlockH = breakdown.qrDataUrl ? QR_GAP + QR_SIZE + QR_CAPTION_H : 0;
  return CARD_PAD + effectiveHeaderH + BODY_TOP_PAD + bodyH + qrBlockH + CARD_PAD;
}

type PersonBreakdownCardArgs = {
  x: number;
  y: number;
  width: number;
  height: number;
  breakdown: PersonBreakdown;
  includeLineItems: boolean;
  qrImage?: HTMLImageElement;
};

function drawPersonBreakdownCard(
  ctx: CanvasRenderingContext2D,
  args: PersonBreakdownCardArgs,
): void {
  const color = getPersonLightColor(args.breakdown.colorIndex);
  drawLightCardShell(ctx, args.x, args.y, args.width, args.height);

  const innerX = args.x + CARD_PAD;
  const innerWidth = args.width - CARD_PAD * 2;
  const effectiveHeaderH = HEADER_H + (args.breakdown.conversion ? CURRENCY_LINE_H * 2 : 0);

  const avatarCX = innerX + AVATAR_RADIUS;
  const avatarCY = args.y + CARD_PAD + AVATAR_RADIUS;
  const initial = args.breakdown.person.name.trim().charAt(0).toUpperCase() || '?';
  drawAvatar(ctx, avatarCX, avatarCY, AVATAR_RADIUS, initial, color.avatarBg, color.avatarText);

  ctx.fillStyle = '#1c1b1f';
  ctx.font = '700 28px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    args.breakdown.person.name,
    innerX + AVATAR_RADIUS * 2 + AVATAR_GAP,
    args.y + CARD_PAD + 30,
  );

  ctx.font = '500 18px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#49454f';
  ctx.textAlign = 'right';
  ctx.fillText(args.breakdown.headerLabel, args.x + args.width - CARD_PAD, args.y + CARD_PAD + 18);
  ctx.font = '600 32px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#1c1b1f';
  ctx.fillText(
    formatCurrencyFromCents(args.breakdown.totalCents, args.breakdown.currency),
    args.x + args.width - CARD_PAD,
    args.y + CARD_PAD + 58,
  );
  ctx.textAlign = 'left';

  if (args.breakdown.conversion) {
    drawCurrencyConversionLines(
      ctx,
      args.x + args.width - CARD_PAD,
      args.y + CARD_PAD + 58 + CURRENCY_LINE_H,
      CURRENCY_LINE_H,
      args.breakdown.totalCents,
      args.breakdown.conversion.rate,
      args.breakdown.conversion.fromCurrency,
    );
  }

  const nestedX = innerX;
  const nestedY = args.y + CARD_PAD + effectiveHeaderH + BODY_TOP_PAD;
  const nestedW = innerWidth;
  const niX = nestedX + RECEIPT_SUB_CARD_PAD;
  const niW = nestedW - RECEIPT_SUB_CARD_PAD * 2;
  let rowY = nestedY;

  if (args.includeLineItems) {
    if (args.breakdown.sections.length > 0) {
      for (const section of args.breakdown.sections) {
        const sectionH = measureReceiptSectionHeight(section, true);
        drawReceiptSection(ctx, {
          x: nestedX,
          y: rowY,
          width: nestedW,
          innerX: niX,
          innerWidth: niW,
          height: sectionH,
          section,
        });
        rowY += sectionH + RECEIPT_SUB_CARD_GAP;
      }
    } else if (args.breakdown.emptyMessage) {
      ctx.fillStyle = '#49454f';
      ctx.font = 'italic 20px system-ui, -apple-system, sans-serif';
      ctx.fillText(args.breakdown.emptyMessage, nestedX, rowY + 28);
    }
  } else {
    drawCollapsedReceiptTotals(ctx, args.breakdown, nestedX, rowY, nestedW);
  }

  if (args.qrImage) {
    const qrDisplayH = QR_SIZE + QR_CAPTION_H;
    const qrY = args.y + args.height - CARD_PAD - qrDisplayH;
    const qrX = args.x + (args.width - QR_SIZE) / 2;
    ctx.drawImage(args.qrImage, qrX, qrY, QR_SIZE, qrDisplayH);
  }
}

type DrawReceiptSectionArgs = {
  x: number;
  y: number;
  width: number;
  innerX: number;
  innerWidth: number;
  height: number;
  section: ReceiptBreakdownSection;
};

function drawReceiptSection(ctx: CanvasRenderingContext2D, args: DrawReceiptSectionArgs): void {
  drawNestedCard(ctx, args.x, args.y, args.width, args.height);

  let rowY = args.y + RECEIPT_SUB_CARD_PAD;

  drawLightTwoColumnRow(ctx, {
    x: args.innerX,
    y: rowY + RECEIPT_LABEL_H - 14,
    width: args.innerWidth,
    label: args.section.title,
    value: formatCurrencyFromCents(args.section.subtotalCents, args.section.currency),
    emphasized: true,
    size: 20,
  });

  if (args.section.conversion) {
    drawCurrencyConversionLines(
      ctx,
      args.innerX + args.innerWidth,
      rowY + RECEIPT_LABEL_H + 18,
      CURRENCY_LINE_H,
      args.section.subtotalCents,
      args.section.conversion.rate,
      args.section.conversion.fromCurrency,
    );
    rowY += CURRENCY_LINE_H * 2;
  }
  rowY += RECEIPT_LABEL_H;

  const sepY = rowY + Math.floor(RECEIPT_HEADER_SEP_H / 2);
  ctx.save();
  ctx.strokeStyle = 'rgba(202,196,208,0.30)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(args.innerX, sepY);
  ctx.lineTo(args.innerX + args.innerWidth, sepY);
  ctx.stroke();
  ctx.restore();
  rowY += RECEIPT_HEADER_SEP_H;

  if (args.section.emptyMessage) {
    ctx.fillStyle = '#49454f';
    ctx.font = 'italic 19px system-ui, -apple-system, sans-serif';
    ctx.fillText(args.section.emptyMessage, args.innerX + 16, rowY + 24);
    return;
  }

  for (const row of args.section.itemRows) {
    drawItemRow(ctx, row, args.innerX + 16, rowY + 22, args.innerWidth - 16);
    rowY += LINE_ROW_H;
  }

  if (args.section.chargeRows.length === 0) {
    return;
  }

  const divY = rowY + 2;
  ctx.strokeStyle = 'rgba(202,196,208,0.40)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(args.innerX, divY);
  ctx.lineTo(args.innerX + args.innerWidth, divY);
  ctx.stroke();
  rowY = divY + DIVIDER_H - 4;

  for (const row of args.section.chargeRows) {
    drawChargeRow(ctx, row, args.innerX, rowY + 22, args.innerWidth);
    rowY += CHARGE_ROW_H;
  }
}

function drawCollapsedReceiptTotals(
  ctx: CanvasRenderingContext2D,
  breakdown: PersonBreakdown,
  x: number,
  y: number,
  width: number,
): void {
  let rowY = y;
  for (const total of breakdown.collapsedReceiptTotals) {
    drawLightTwoColumnRow(ctx, {
      x,
      y: rowY + 22,
      width,
      label: total.label,
      value: formatCurrencyFromCents(total.subtotalCents, total.currency),
      size: 19,
    });
    rowY += LINE_ROW_H;
  }
}

function drawItemRow(
  ctx: CanvasRenderingContext2D,
  row: BreakdownItemRow,
  x: number,
  y: number,
  width: number,
): void {
  if (!row.involved) ctx.globalAlpha = 0.4;
  drawLightTwoColumnRow(ctx, {
    x,
    y,
    width,
    label: row.label,
    value: row.amountCents !== null ? formatCurrencyFromCents(row.amountCents, row.currency) : '—',
    italic: !row.involved,
    size: 19,
  });
  if (!row.involved) ctx.globalAlpha = 1;
}

function drawChargeRow(
  ctx: CanvasRenderingContext2D,
  row: BreakdownChargeRow,
  x: number,
  y: number,
  width: number,
): void {
  drawLightTwoColumnRow(ctx, {
    x,
    y,
    width,
    label: row.label,
    value: `${row.sign === 'minus' ? '−' : '+'}${formatCurrencyFromCents(
      row.amountCents,
      row.currency,
    )}`,
    valueColor: row.sign === 'minus' ? '#16a34a' : undefined,
    italic: true,
    size: 19,
  });
}
