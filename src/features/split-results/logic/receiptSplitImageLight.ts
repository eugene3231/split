import type { ChargeState, Person, Receipt, SplitResult } from '@shared/types';
import { formatCurrencyFromCents, parseNumber } from '@shared/logic/core/money';
import {
  CANVAS_WIDTH,
  canvasToBlob,
  formatGeneratedAt,
  formatPercent,
  getPersonLightColor,
  drawLightCardShell,
  drawNestedCard,
  drawAvatar,
  drawRoundedRect,
  drawLightTwoColumnRow,
  drawCurrencyConversionLines,
} from '@features/split-results/logic/receiptSplitImageLightHelpers';
import { generatePaynowQrDataUrls, normalizeMobile } from '@features/payments';

type GenerateReceiptSplitImageLightOptions = {
  people: Person[];
  split: SplitResult;
  receipts?: Receipt[];
  splitByReceipt?: SplitResult[];
  discount: ChargeState;
  serviceCharge: ChargeState;
  gst: ChargeState;
  reconciliationCents: number | null;
  includeItemDetails: boolean;
  receiptName?: string;
  currency?: string;
  /** Normalised payer PayNow mobile (+65XXXXXXXX). When set, a QR code is embedded in each person card. */
  payerMobile?: string;
  /** SGD-denominated split used for QR amounts. Falls back to `split` when omitted. */
  sgdSplit?: SplitResult;
  /** SGD-per-native rate for a single foreign-currency receipt tab. Draws conversion lines in each person card header. */
  conversionRate?: number;
  /** Native currency code paired with conversionRate (e.g. 'JPY'). */
  fromCurrency?: string;
  /** Per-receipt effective rates, parallel to receipts/splitByReceipt. Draws conversion lines inside each receipt sub-card. */
  effectiveRatesByReceipt?: (number | undefined)[];
};

// Layout constants
const CANVAS_PADDING = 56; // horizontal/vertical page margin
const QR_SIZE = 160; // QR code dimensions (logical px, square)
const QR_GAP = 20; // vertical gap between nested card and QR block
// Caption: padV(10) + 2×(labelLineH(17)+valueLineH(23)) + groupGap(8) + padV(10) = 108px logical
const QR_CAPTION_H = 108;
const CARD_PAD = 32;
const AVATAR_RADIUS = 22;
const AVATAR_GAP = 16; // gap between avatar and name
const HEADER_H = 88; // height of the person card header section
const NESTED_PAD = 0; // top margin before first receipt sub-card (sub-cards have their own RECEIPT_SUB_CARD_PAD)
const LINE_ROW_H = 34; // height per line item row
const RECEIPT_LABEL_H = 40; // height of receipt name row within nested card
const CHARGE_ROW_H = 34; // height per charge row
const DIVIDER_H = 22; // space around divider line
const BODY_TOP_PAD = 16; // gap between person card header and first receipt sub-card
const NESTED_BOTTOM_PAD = 0; // bottom margin after last receipt sub-card (CARD_PAD already provides space)
const BETWEEN_CARD_GAP = 20; // vertical gap between person cards
const GRAND_TOTAL_CARD_H = 116; // fixed height of the grand total card
const GRAND_TOTAL_AFTER_GAP = 32; // gap below grand total card
const RECEIPT_SUB_CARD_PAD = 20; // inner padding (top/bottom) per receipt sub-card
const RECEIPT_SUB_CARD_GAP = 12; // gap between stacked receipt sub-cards
const CURRENCY_LINE_H = 22; // height per currency conversion text line
const RECEIPT_HEADER_SEP_H = 16; // vertical space of separator between receipt header and item rows

function computeRequiredHeight(
  options: GenerateReceiptSplitImageLightOptions,
  cols: number,
): number {
  const hasValidMobile = !!options.payerMobile && !!normalizeMobile(options.payerMobile);
  const sgdSplit = options.sgdSplit ?? options.split;

  let y = CANVAS_PADDING + 36 + 40; // start + title + subtitle
  y += GRAND_TOTAL_CARD_H + GRAND_TOTAL_AFTER_GAP;

  if (options.people.length === 0) {
    y += 72 + BETWEEN_CARD_GAP;
  } else {
    for (let rowStart = 0; rowStart < options.people.length; rowStart += cols) {
      const rowPeople = options.people.slice(
        rowStart,
        Math.min(rowStart + cols, options.people.length),
      );
      let rowHeight = 0;
      for (const person of rowPeople) {
        const amountCents = sgdSplit.totalByPersonCents[person.id] ?? 0;
        const hasQr = hasValidMobile && amountCents > 0;
        rowHeight = Math.max(
          rowHeight,
          measurePersonCardHeight(
            person.id,
            options.split,
            options.receipts,
            options.splitByReceipt,
            options.includeItemDetails,
            hasQr,
            !!(options.conversionRate && options.fromCurrency),
            options.effectiveRatesByReceipt,
          ),
        );
      }
      y += rowHeight + BETWEEN_CARD_GAP;
    }
  }

  if (options.split.unassignedItemCount > 0) {
    y += 72 + BETWEEN_CARD_GAP;
  }

  return Math.max(240, Math.ceil(y + CANVAS_PADDING));
}

// ─── QR helpers ───────────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function preloadQrImages(
  people: Person[],
  split: SplitResult,
  payerMobile: string | undefined,
): Promise<Map<string, HTMLImageElement>> {
  if (!payerMobile) return new Map();
  const dataUrls = await generatePaynowQrDataUrls(people, split, payerMobile, QR_SIZE);
  const entries = await Promise.all(
    Object.entries(dataUrls)
      .filter(([, url]) => url)
      .map(async ([id, url]) => [id, await loadImage(url)] as const),
  );
  return new Map(entries);
}

// ─── Main export ───────────────────────────────────────────────────────────────

export async function generateReceiptSplitImageLight(
  options: GenerateReceiptSplitImageLightOptions,
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('Image export is only available in the browser.');
  }

  const COLS = options.people.length >= 5 ? 3 : 2;
  const canvasWidth = COLS === 3 ? 2700 : CANVAS_WIDTH;

  const scratch = document.createElement('canvas');
  scratch.width = canvasWidth;
  scratch.height = computeRequiredHeight(options, COLS);

  const ctx = scratch.getContext('2d');
  if (!ctx) throw new Error('Unable to initialize canvas renderer.');

  // Pre-generate QR images (async, before any drawing)
  const qrImages = await preloadQrImages(
    options.people,
    options.sgdSplit ?? options.split,
    options.payerMobile,
  );

  // Light background
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, scratch.width, scratch.height);

  let y = CANVAS_PADDING;
  const x = CANVAS_PADDING;
  const cardWidth = canvasWidth - x * 2;

  // Title
  ctx.fillStyle = '#1c1b1f';
  ctx.font = '700 44px system-ui, -apple-system, sans-serif';
  ctx.fillText(options.receiptName || 'Receipt Splitter', x, y);
  y += 36;

  ctx.fillStyle = '#49454f';
  ctx.font = '500 22px system-ui, -apple-system, sans-serif';
  ctx.fillText(`Generated ${formatGeneratedAt(new Date())}`, x, y);
  y += 40;

  // Grand total card (teal gradient)
  y = drawGrandTotalCard(ctx, {
    x,
    y,
    width: cardWidth,
    split: options.split,
    currency: options.currency,
  });
  y += GRAND_TOTAL_AFTER_GAP;

  // Person cards — adaptive column grid
  if (options.people.length === 0) {
    drawLightCardShell(ctx, x, y, cardWidth, 72);
    ctx.fillStyle = '#49454f';
    ctx.font = '500 22px system-ui, -apple-system, sans-serif';
    ctx.fillText('No people added yet.', x + CARD_PAD, y + 46);
    y += 72 + BETWEEN_CARD_GAP;
  } else {
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
          measurePersonCardHeight(
            person.id,
            options.split,
            options.receipts,
            options.splitByReceipt,
            options.includeItemDetails,
            qrImages.has(person.id),
            !!(options.conversionRate && options.fromCurrency),
            options.effectiveRatesByReceipt,
          ),
        );
      }

      for (let col = 0; col < rowPeople.length; col++) {
        const person = rowPeople[col];
        drawPersonCard(ctx, {
          x: x + col * (colWidth + COL_GAP),
          y,
          width: colWidth,
          height: rowHeight,
          colorIndex: rowStart + col,
          person,
          split: options.split,
          receipts: options.receipts,
          splitByReceipt: options.splitByReceipt,
          includeLineItems: options.includeItemDetails,
          discount: options.discount,
          serviceCharge: options.serviceCharge,
          gst: options.gst,
          currency: options.currency,
          qrImage: qrImages.get(person.id),
          conversionRate: options.conversionRate,
          fromCurrency: options.fromCurrency,
          effectiveRatesByReceipt: options.effectiveRatesByReceipt,
        });
      }

      y += rowHeight + BETWEEN_CARD_GAP;
    }
  }

  // Unassigned items warning
  if (options.split.unassignedItemCount > 0) {
    const warnH = 72;
    ctx.save();
    ctx.fillStyle = '#fef3c7';
    drawRoundedRect(ctx, x, y, cardWidth, warnH, 16);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#92400e';
    ctx.font = '500 22px system-ui, -apple-system, sans-serif';
    ctx.fillText(
      `${options.split.unassignedItemCount} item(s) are unassigned and excluded from totals.`,
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

// ─── Grand total card ────────────────────────────────────────────────────────

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

// ─── Person card height measurement ──────────────────────────────────────────

function measureReceiptBlockHeight(
  personId: string,
  receiptSplit: SplitResult,
  includeLineItems: boolean,
  effectiveRate?: number,
): number {
  const lines = receiptSplit.lineItemsByPerson[personId] ?? [];
  const discountCents = receiptSplit.discountByPersonCents[personId] ?? 0;
  const chargeRows = 2 + (discountCents > 0 ? 1 : 0); // Service + GST [+ Discount]
  const hasRate = effectiveRate !== undefined;
  const detailH = includeLineItems
    ? lines.length * LINE_ROW_H + RECEIPT_HEADER_SEP_H + DIVIDER_H + chargeRows * CHARGE_ROW_H
    : RECEIPT_HEADER_SEP_H;
  // Sub-card: top-pad + receipt-name-row + optional-conversion-lines + items/separator + bottom-pad
  return (
    RECEIPT_SUB_CARD_PAD +
    RECEIPT_LABEL_H +
    (hasRate ? CURRENCY_LINE_H * 2 : 0) +
    detailH +
    RECEIPT_SUB_CARD_PAD
  );
}

function measurePersonCardHeight(
  personId: string,
  split: SplitResult,
  receipts: Receipt[] | undefined,
  splitByReceipt: SplitResult[] | undefined,
  includeLineItems: boolean,
  hasQr: boolean = false,
  hasPersonConversion: boolean = false,
  effectiveRatesByReceipt?: (number | undefined)[],
): number {
  const effectiveHeaderH = HEADER_H + (hasPersonConversion ? CURRENCY_LINE_H * 2 : 0);

  let nestedBodyH: number;

  if (receipts && splitByReceipt && receipts.length > 0) {
    let bodyH = 0;
    let validReceiptCount = 0;
    for (let i = 0; i < receipts.length; i++) {
      const rSplit = splitByReceipt[i];
      if (!rSplit) continue;
      bodyH += measureReceiptBlockHeight(
        personId,
        rSplit,
        includeLineItems,
        effectiveRatesByReceipt?.[i],
      );
      validReceiptCount++;
    }
    // Add gaps between sub-cards (N-1 gaps for N receipts)
    bodyH += Math.max(0, validReceiptCount - 1) * RECEIPT_SUB_CARD_GAP;
    nestedBodyH = bodyH;
  } else {
    const lines = split.lineItemsByPerson[personId] ?? [];
    const discountCents = split.discountByPersonCents[personId] ?? 0;
    const chargeRows = 2 + (discountCents > 0 ? 1 : 0);
    nestedBodyH = includeLineItems
      ? lines.length * LINE_ROW_H + DIVIDER_H + chargeRows * CHARGE_ROW_H
      : 0;
  }

  // nestedH: outer NESTED_PAD wraps all receipt sub-cards (sub-cards have their own internal padding)
  const nestedH = NESTED_PAD + nestedBodyH + NESTED_BOTTOM_PAD;
  const qrBlockH = hasQr ? QR_GAP + QR_SIZE + QR_CAPTION_H : 0;
  return CARD_PAD + effectiveHeaderH + BODY_TOP_PAD + nestedH + qrBlockH + CARD_PAD;
}

// ─── Person card drawing ──────────────────────────────────────────────────────

type PersonCardArgs = {
  x: number;
  y: number;
  width: number;
  height: number;
  colorIndex: number;
  person: Person;
  split: SplitResult;
  receipts?: Receipt[];
  splitByReceipt?: SplitResult[];
  includeLineItems: boolean;
  discount: ChargeState;
  serviceCharge: ChargeState;
  gst: ChargeState;
  currency?: string;
  qrImage?: HTMLImageElement;
  /** Person-level SGD conversion rate (ReceiptTabView, single foreign receipt). */
  conversionRate?: number;
  /** Native currency code paired with conversionRate. */
  fromCurrency?: string;
  /** Per-receipt effective rates, parallel to receipts/splitByReceipt. */
  effectiveRatesByReceipt?: (number | undefined)[];
};

function drawPersonCard(ctx: CanvasRenderingContext2D, args: PersonCardArgs): void {
  const color = getPersonLightColor(args.colorIndex);
  drawLightCardShell(ctx, args.x, args.y, args.width, args.height);

  const innerX = args.x + CARD_PAD;
  const innerWidth = args.width - CARD_PAD * 2;
  const hasPersonConversion = !!(args.conversionRate && args.fromCurrency);
  const effectiveHeaderH = HEADER_H + (hasPersonConversion ? CURRENCY_LINE_H * 2 : 0);

  // ── Header ──────────────────────────────────────────────────────────────────
  const avatarCX = innerX + AVATAR_RADIUS;
  const avatarCY = args.y + CARD_PAD + AVATAR_RADIUS;
  const initial = args.person.name.trim().charAt(0).toUpperCase() || '?';
  drawAvatar(ctx, avatarCX, avatarCY, AVATAR_RADIUS, initial, color.avatarBg, color.avatarText);

  ctx.fillStyle = '#1c1b1f';
  ctx.font = '700 28px system-ui, -apple-system, sans-serif';
  ctx.fillText(args.person.name, innerX + AVATAR_RADIUS * 2 + AVATAR_GAP, args.y + CARD_PAD + 30);

  const total = args.split.totalByPersonCents[args.person.id] ?? 0;
  ctx.font = '500 18px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#49454f';
  ctx.textAlign = 'right';
  ctx.fillText('Total Due', args.x + args.width - CARD_PAD, args.y + CARD_PAD + 18);
  ctx.font = '600 32px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#1c1b1f';
  ctx.fillText(
    formatCurrencyFromCents(total, args.currency),
    args.x + args.width - CARD_PAD,
    args.y + CARD_PAD + 58,
  );
  ctx.textAlign = 'left';

  if (hasPersonConversion) {
    drawCurrencyConversionLines(
      ctx,
      args.x + args.width - CARD_PAD,
      args.y + CARD_PAD + 58 + CURRENCY_LINE_H,
      CURRENCY_LINE_H,
      total,
      args.conversionRate!,
      args.fromCurrency!,
    );
  }

  // ── Per-receipt sub-cards ────────────────────────────────────────────────────
  const nestedX = innerX;
  const nestedY = args.y + CARD_PAD + effectiveHeaderH + BODY_TOP_PAD;
  const nestedW = innerWidth;
  // Inner x/width used for content inside each sub-card
  const niX = nestedX + RECEIPT_SUB_CARD_PAD;
  const niW = nestedW - RECEIPT_SUB_CARD_PAD * 2;
  let subCardY = nestedY + NESTED_PAD;

  if (args.receipts && args.splitByReceipt && args.receipts.length > 0) {
    for (let i = 0; i < args.receipts.length; i++) {
      const receipt = args.receipts[i];
      const rSplit = args.splitByReceipt[i];
      if (!rSplit) continue;

      const effectiveRate = args.effectiveRatesByReceipt?.[i];
      const personReceiptTotal = rSplit.totalByPersonCents[args.person.id] ?? 0;
      const subCardH = measureReceiptBlockHeight(
        args.person.id,
        rSplit,
        args.includeLineItems,
        effectiveRate,
      );

      // Draw sub-card background (gray rounded rect, like UI's bg-surface-container-low)
      drawNestedCard(ctx, nestedX, subCardY, nestedW, subCardH);

      let rowY = subCardY + RECEIPT_SUB_CARD_PAD;

      // ── Receipt header: bold name left, subtotal right ──────────────────────
      drawLightTwoColumnRow(ctx, {
        x: niX,
        y: rowY + RECEIPT_LABEL_H - 14,
        width: niW,
        label: receipt.name || `Receipt ${i + 1}`,
        value: formatCurrencyFromCents(personReceiptTotal, receipt.currency),
        emphasized: true,
        size: 20,
      });

      // Optional per-receipt currency conversion lines below subtotal
      if (effectiveRate !== undefined) {
        drawCurrencyConversionLines(
          ctx,
          niX + niW,
          rowY + RECEIPT_LABEL_H + 18,
          CURRENCY_LINE_H,
          personReceiptTotal,
          effectiveRate,
          receipt.currency ?? 'SGD',
        );
        rowY += CURRENCY_LINE_H * 2;
      }
      rowY += RECEIPT_LABEL_H;

      // Header separator
      const sepY = rowY + Math.floor(RECEIPT_HEADER_SEP_H / 2);
      ctx.save();
      ctx.strokeStyle = 'rgba(202,196,208,0.30)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(niX, sepY);
      ctx.lineTo(niX + niW, sepY);
      ctx.stroke();
      ctx.restore();
      rowY += RECEIPT_HEADER_SEP_H;

      // ── Line items + charges ────────────────────────────────────────────────
      if (args.includeLineItems) {
        const lines = rSplit.lineItemsByPerson[args.person.id] ?? [];
        for (const line of lines) {
          if (!line.involved) ctx.globalAlpha = 0.4;
          drawLightTwoColumnRow(ctx, {
            x: niX + 16,
            y: rowY + 22,
            width: niW - 16,
            label: line.name,
            value: line.involved
              ? formatCurrencyFromCents(line.assignedAmountCents, receipt.currency)
              : '—',
            italic: !line.involved,
            size: 19,
          });
          if (!line.involved) ctx.globalAlpha = 1;
          rowY += LINE_ROW_H;
        }

        // Divider before charges
        const divY = rowY + 2;
        ctx.strokeStyle = 'rgba(202,196,208,0.40)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(niX, divY);
        ctx.lineTo(niX + niW, divY);
        ctx.stroke();
        rowY = divY + DIVIDER_H - 4;

        const discountCents = rSplit.discountByPersonCents[args.person.id] ?? 0;
        const serviceAmt = rSplit.serviceByPersonCents[args.person.id] ?? 0;
        const gstAmt = rSplit.gstByPersonCents[args.person.id] ?? 0;

        if (discountCents > 0) {
          drawLightTwoColumnRow(ctx, {
            x: niX,
            y: rowY + 22,
            width: niW,
            label: buildChargeLabel('Discount', receipt.discount),
            value: `−${formatCurrencyFromCents(discountCents, receipt.currency)}`,
            valueColor: '#16a34a',
            italic: true,
            size: 19,
          });
          rowY += CHARGE_ROW_H;
        }

        drawLightTwoColumnRow(ctx, {
          x: niX,
          y: rowY + 22,
          width: niW,
          label: buildChargeLabel('Service Charge', receipt.serviceCharge),
          value: `+${formatCurrencyFromCents(serviceAmt, receipt.currency)}`,
          italic: true,
          size: 19,
        });
        rowY += CHARGE_ROW_H;

        drawLightTwoColumnRow(ctx, {
          x: niX,
          y: rowY + 22,
          width: niW,
          label: buildChargeLabel('GST / Tax', receipt.gst),
          value: `+${formatCurrencyFromCents(gstAmt, receipt.currency)}`,
          italic: true,
          size: 19,
        });
      }

      subCardY += subCardH + RECEIPT_SUB_CARD_GAP;
    }
  } else {
    // ── Single-receipt fallback (no receipts array provided) ─────────────────
    const subCardH = measureReceiptBlockHeight(args.person.id, args.split, args.includeLineItems);
    drawNestedCard(ctx, nestedX, subCardY, nestedW, subCardH);

    let rowY = subCardY + RECEIPT_SUB_CARD_PAD + RECEIPT_HEADER_SEP_H;

    if (args.includeLineItems) {
      const lines = args.split.lineItemsByPerson[args.person.id] ?? [];
      for (const line of lines) {
        if (!line.involved) ctx.globalAlpha = 0.4;
        drawLightTwoColumnRow(ctx, {
          x: niX + 16,
          y: rowY + 22,
          width: niW - 16,
          label: line.name,
          value: line.involved
            ? formatCurrencyFromCents(line.assignedAmountCents, args.currency)
            : '—',
          italic: !line.involved,
          size: 20,
        });
        if (!line.involved) ctx.globalAlpha = 1;
        rowY += LINE_ROW_H;
      }

      const divY = rowY + 4;
      ctx.strokeStyle = 'rgba(202,196,208,0.40)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(niX, divY);
      ctx.lineTo(niX + niW, divY);
      ctx.stroke();
      rowY = divY + DIVIDER_H - 4;

      const discountCents = args.split.discountByPersonCents[args.person.id] ?? 0;
      const serviceAmt = args.split.serviceByPersonCents[args.person.id] ?? 0;
      const gstAmt = args.split.gstByPersonCents[args.person.id] ?? 0;

      if (discountCents > 0) {
        drawLightTwoColumnRow(ctx, {
          x: niX,
          y: rowY + 22,
          width: niW,
          label: buildChargeLabel('Discount', args.discount),
          value: `−${formatCurrencyFromCents(discountCents, args.currency)}`,
          valueColor: '#16a34a',
          italic: true,
          size: 20,
        });
        rowY += CHARGE_ROW_H;
      }

      drawLightTwoColumnRow(ctx, {
        x: niX,
        y: rowY + 22,
        width: niW,
        label: buildChargeLabel('Service Charge', args.serviceCharge),
        value: `+${formatCurrencyFromCents(serviceAmt, args.currency)}`,
        italic: true,
        size: 20,
      });
      rowY += CHARGE_ROW_H;

      drawLightTwoColumnRow(ctx, {
        x: niX,
        y: rowY + 22,
        width: niW,
        label: buildChargeLabel('GST / Tax', args.gst),
        value: `+${formatCurrencyFromCents(gstAmt, args.currency)}`,
        italic: true,
        size: 20,
      });
    }
  }

  // ── QR code block ────────────────────────────────────────────────────────────
  if (args.qrImage) {
    const qrDisplayH = QR_SIZE + QR_CAPTION_H;
    const qrY = args.y + args.height - CARD_PAD - qrDisplayH;
    const qrX = args.x + (args.width - QR_SIZE) / 2;
    // Draw at natural aspect ratio — the image includes the mobile/amount caption
    ctx.drawImage(args.qrImage, qrX, qrY, QR_SIZE, qrDisplayH);
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
