import type { ChargeState, Person, Receipt, SplitResult } from '@shared/types';
import { formatCurrencyFromCents, parseNumber } from '@shared/logic/core/money';
import {
  CANVAS_WIDTH,
  SCRATCH_HEIGHT,
  canvasToBlob,
  formatGeneratedAt,
  formatPercent,
  getPersonLightColor,
  drawLightCardShell,
  drawNestedCard,
  drawAvatar,
  drawRoundedRect,
  drawLightTwoColumnRow,
} from '@features/split-results/logic/receiptSplitImageLightHelpers';

export type GenerateConsolidatedSplitImageLightOptions = {
  people: Person[];
  consolidatedSplit: SplitResult;
  splitByReceipt: SplitResult[];
  receipts: Receipt[];
  title?: string;
};

// Layout constants (shared with single-receipt generator)
const CARD_PAD = 32;
const AVATAR_RADIUS = 22;
const AVATAR_GAP = 16;
const HEADER_H = 88;
const NESTED_PAD = 24;
const ITEM_ROW_H = 32;
const RECEIPT_LABEL_H = 38;
const CHARGE_ROW_H = 36;
const DIVIDER_H = 20;
const BODY_TOP_PAD = 24;
const NESTED_BOTTOM_PAD = 24;
const BETWEEN_CARD_GAP = 20;

export async function generateConsolidatedSplitImageLight(
  options: GenerateConsolidatedSplitImageLightOptions,
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('Image export is only available in the browser.');
  }

  const scratch = document.createElement('canvas');
  scratch.width = CANVAS_WIDTH;
  scratch.height = SCRATCH_HEIGHT;

  const ctx = scratch.getContext('2d');
  if (!ctx) throw new Error('Unable to initialize canvas renderer.');

  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, scratch.width, scratch.height);

  let y = 56;
  const x = 56;
  const cardWidth = CANVAS_WIDTH - x * 2;

  // Title
  ctx.fillStyle = '#1c1b1f';
  ctx.font = '700 44px system-ui, -apple-system, sans-serif';
  ctx.fillText(options.title || 'Split Summary', x, y);
  y += 36;

  ctx.fillStyle = '#49454f';
  ctx.font = '500 22px system-ui, -apple-system, sans-serif';
  ctx.fillText(`Generated ${formatGeneratedAt(new Date())}`, x, y);
  y += 40;

  // Grand total card
  y = drawGrandTotalCard(ctx, {
    x,
    y,
    width: cardWidth,
    consolidatedSplit: options.consolidatedSplit,
  });
  y += 32;

  if (options.people.length === 0) {
    drawLightCardShell(ctx, x, y, cardWidth, 72);
    ctx.fillStyle = '#49454f';
    ctx.font = '500 22px system-ui, -apple-system, sans-serif';
    ctx.fillText('No people added yet.', x + CARD_PAD, y + 46);
    y += 72 + BETWEEN_CARD_GAP;
  } else {
    const COLS = 2;
    const COL_GAP = 24;
    const colWidth = Math.floor((cardWidth - COL_GAP * (COLS - 1)) / COLS);

    for (let rowStart = 0; rowStart < options.people.length; rowStart += COLS) {
      const rowPeople = options.people.slice(
        rowStart,
        Math.min(rowStart + COLS, options.people.length),
      );

      let rowHeight = 0;
      for (const person of rowPeople) {
        rowHeight = Math.max(
          rowHeight,
          measurePersonCardHeight(person.id, options.splitByReceipt, options.receipts),
        );
      }

      for (let col = 0; col < rowPeople.length; col++) {
        drawPersonCard(ctx, {
          x: x + col * (colWidth + COL_GAP),
          y,
          width: colWidth,
          height: rowHeight,
          colorIndex: rowStart + col,
          person: rowPeople[col],
          consolidatedSplit: options.consolidatedSplit,
          splitByReceipt: options.splitByReceipt,
          receipts: options.receipts,
        });
      }

      y += rowHeight + BETWEEN_CARD_GAP;
    }
  }

  if (options.consolidatedSplit.unassignedItemCount > 0) {
    const warnH = 72;
    ctx.save();
    ctx.fillStyle = '#fef3c7';
    drawRoundedRect(ctx, x, y, cardWidth, warnH, 16);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#92400e';
    ctx.font = '500 22px system-ui, -apple-system, sans-serif';
    ctx.fillText(
      `${options.consolidatedSplit.unassignedItemCount} item(s) are unassigned and excluded from totals.`,
      x + CARD_PAD,
      y + 44,
    );
    y += warnH + BETWEEN_CARD_GAP;
  }

  const requiredHeight = Math.max(240, Math.ceil(y + 56));
  if (requiredHeight > scratch.height) {
    throw new Error('Export is too large.');
  }

  const output = document.createElement('canvas');
  output.width = CANVAS_WIDTH;
  output.height = requiredHeight;
  const outCtx = output.getContext('2d');
  if (!outCtx) throw new Error('Unable to finalize image export.');
  outCtx.drawImage(scratch, 0, 0, CANVAS_WIDTH, requiredHeight, 0, 0, output.width, output.height);
  return canvasToBlob(output);
}

// ─── Grand total card ────────────────────────────────────────────────────────

function drawGrandTotalCard(
  ctx: CanvasRenderingContext2D,
  args: {
    x: number;
    y: number;
    width: number;
    consolidatedSplit: SplitResult;
  },
): number {
  const h = 116;

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
    formatCurrencyFromCents(args.consolidatedSplit.grandTotalCents),
    args.x + CARD_PAD,
    args.y + 92,
  );

  return args.y + h;
}

// ─── Person card height measurement ──────────────────────────────────────────

function measurePersonCardHeight(
  personId: string,
  splitByReceipt: SplitResult[],
  receipts: Receipt[],
): number {
  let bodyH = 0;
  for (let i = 0; i < receipts.length; i++) {
    const receiptSplit = splitByReceipt[i];
    const personTotal = receiptSplit?.totalByPersonCents[personId] ?? 0;
    if (personTotal === 0) continue;
    const lineItems = receiptSplit?.lineItemsByPerson[personId] ?? [];
    const hasDiscount = (receiptSplit?.discountByPersonCents[personId] ?? 0) > 0;
    const chargeRows = 2 + (hasDiscount ? 1 : 0);
    bodyH +=
      RECEIPT_LABEL_H + lineItems.length * ITEM_ROW_H + DIVIDER_H + chargeRows * CHARGE_ROW_H + 16;
  }
  const nestedH = NESTED_PAD + Math.max(bodyH, RECEIPT_LABEL_H) + NESTED_BOTTOM_PAD;
  return CARD_PAD + HEADER_H + BODY_TOP_PAD + nestedH + CARD_PAD;
}

// ─── Person card drawing ──────────────────────────────────────────────────────

function drawPersonCard(
  ctx: CanvasRenderingContext2D,
  args: {
    x: number;
    y: number;
    width: number;
    height: number;
    colorIndex: number;
    person: Person;
    consolidatedSplit: SplitResult;
    splitByReceipt: SplitResult[];
    receipts: Receipt[];
  },
): void {
  const color = getPersonLightColor(args.colorIndex);
  drawLightCardShell(ctx, args.x, args.y, args.width, args.height);

  const innerX = args.x + CARD_PAD;
  const innerWidth = args.width - CARD_PAD * 2;

  // Header
  const avatarCX = innerX + AVATAR_RADIUS;
  const avatarCY = args.y + CARD_PAD + AVATAR_RADIUS;
  const initial = args.person.name.trim().charAt(0).toUpperCase() || '?';
  drawAvatar(ctx, avatarCX, avatarCY, AVATAR_RADIUS, initial, color.avatarBg, color.avatarText);

  ctx.fillStyle = '#1c1b1f';
  ctx.font = '700 28px system-ui, -apple-system, sans-serif';
  ctx.fillText(args.person.name, innerX + AVATAR_RADIUS * 2 + AVATAR_GAP, args.y + CARD_PAD + 30);

  const total = args.consolidatedSplit.totalByPersonCents[args.person.id] ?? 0;
  ctx.font = '500 18px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#49454f';
  ctx.textAlign = 'right';
  ctx.fillText('Total Consolidated', args.x + args.width - CARD_PAD, args.y + CARD_PAD + 18);

  ctx.font = '600 32px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#1c1b1f';
  ctx.fillText(
    formatCurrencyFromCents(total),
    args.x + args.width - CARD_PAD,
    args.y + CARD_PAD + 58,
  );
  ctx.textAlign = 'left';

  // Nested card
  const nestedX = innerX;
  const nestedY = args.y + CARD_PAD + HEADER_H + BODY_TOP_PAD;
  const nestedW = innerWidth;
  const nestedH = args.height - (CARD_PAD + HEADER_H + BODY_TOP_PAD + CARD_PAD);
  drawNestedCard(ctx, nestedX, nestedY, nestedW, nestedH);

  const nestedInnerX = nestedX + NESTED_PAD;
  const nestedInnerW = nestedW - NESTED_PAD * 2;
  let rowY = nestedY + NESTED_PAD;

  for (let i = 0; i < args.receipts.length; i++) {
    const receipt = args.receipts[i];
    const receiptSplit = args.splitByReceipt[i];
    const personTotal = receiptSplit?.totalByPersonCents[args.person.id] ?? 0;
    if (personTotal === 0) continue;

    const lineItems = receiptSplit?.lineItemsByPerson[args.person.id] ?? [];

    // Receipt name row
    drawLightTwoColumnRow(ctx, {
      x: nestedInnerX,
      y: rowY + 24,
      width: nestedInnerW,
      label: receipt.name || `Receipt ${i + 1}`,
      value: formatCurrencyFromCents(personTotal),
      emphasized: true,
      size: 22,
    });
    rowY += RECEIPT_LABEL_H;

    // Line items (indented)
    for (const line of lineItems) {
      if (!line.involved) ctx.globalAlpha = 0.4;
      drawLightTwoColumnRow(ctx, {
        x: nestedInnerX + 16,
        y: rowY + 22,
        width: nestedInnerW - 16,
        label: line.name,
        value: line.involved ? formatCurrencyFromCents(line.assignedAmountCents) : '—',
        italic: !line.involved,
        size: 19,
      });
      if (!line.involved) ctx.globalAlpha = 1;
      rowY += ITEM_ROW_H;
    }

    // Divider
    const dividerY = rowY + 4;
    ctx.strokeStyle = 'rgba(202, 196, 208, 0.40)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(nestedInnerX, dividerY);
    ctx.lineTo(nestedInnerX + nestedInnerW, dividerY);
    ctx.stroke();
    rowY = dividerY + DIVIDER_H - 4;

    // Charge rows
    const discountCents = receiptSplit?.discountByPersonCents[args.person.id] ?? 0;
    const serviceAmt = receiptSplit?.serviceByPersonCents[args.person.id] ?? 0;
    const gstAmt = receiptSplit?.gstByPersonCents[args.person.id] ?? 0;

    if (discountCents > 0) {
      drawLightTwoColumnRow(ctx, {
        x: nestedInnerX + 16,
        y: rowY + 22,
        width: nestedInnerW - 16,
        label: buildChargeLabel('Discount', receipt.discount),
        value: `−${formatCurrencyFromCents(discountCents)}`,
        valueColor: '#16a34a',
        italic: true,
        size: 19,
      });
      rowY += CHARGE_ROW_H;
    }

    drawLightTwoColumnRow(ctx, {
      x: nestedInnerX + 16,
      y: rowY + 22,
      width: nestedInnerW - 16,
      label: buildChargeLabel('Service Charge', receipt.serviceCharge),
      value: `+${formatCurrencyFromCents(serviceAmt)}`,
      italic: true,
      size: 19,
    });
    rowY += CHARGE_ROW_H;

    drawLightTwoColumnRow(ctx, {
      x: nestedInnerX + 16,
      y: rowY + 22,
      width: nestedInnerW - 16,
      label: buildChargeLabel('GST / Tax', receipt.gst),
      value: `+${formatCurrencyFromCents(gstAmt)}`,
      italic: true,
      size: 19,
    });
    rowY += CHARGE_ROW_H + 16;
  }
}

function buildChargeLabel(label: string, charge: ChargeState): string {
  if (!charge.enabled) return `${label} (off)`;
  if (charge.mode === 'percent') {
    const parsed = parseNumber(charge.percentInput);
    if (parsed !== null) return `${label} (${formatPercent(parsed)}%)`;
    return `${label} (%)`;
  }
  return label;
}
