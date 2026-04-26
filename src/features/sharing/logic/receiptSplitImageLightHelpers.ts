// Light-theme canvas drawing utilities for receipt split image generators.
// Reuses shared constants and utilities from the base helpers file.

import { ellipsizeText } from '@features/sharing/logic/receiptSplitImageHelpers';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { BASE_CURRENCY } from '@shared/constants';

export {
  CANVAS_WIDTH,
  SCRATCH_HEIGHT,
  canvasToBlob,
  formatGeneratedAt,
  formatPercent,
  ellipsizeText,
} from '@features/sharing/logic/receiptSplitImageHelpers';

// 8-color palette matching personColors.ts (Plate oklch-based)
const PERSON_LIGHT_COLORS = [
  { avatarBg: '#c54a2f', avatarText: '#ffffff', accent: '#c54a2f' }, // tomato
  { avatarBg: '#2a7338', avatarText: '#ffffff', accent: '#2a7338' }, // basil
  { avatarBg: '#b87420', avatarText: '#ffffff', accent: '#b87420' }, // citrus
  { avatarBg: '#335598', avatarText: '#ffffff', accent: '#335598' }, // mineral
  { avatarBg: '#7a3daa', avatarText: '#ffffff', accent: '#7a3daa' }, // purple
  { avatarBg: '#1a7a6a', avatarText: '#ffffff', accent: '#1a7a6a' }, // teal
  { avatarBg: '#b87828', avatarText: '#ffffff', accent: '#b87828' }, // amber
  { avatarBg: '#5040a0', avatarText: '#ffffff', accent: '#5040a0' }, // indigo
];

export function getPersonLightColor(index: number) {
  return PERSON_LIGHT_COLORS[index % PERSON_LIGHT_COLORS.length];
}

export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

/** Cream card — like bg-cream rounded-[22px] */
export function drawLightCardShell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): number {
  ctx.save();
  ctx.fillStyle = '#f2ede2';
  drawRoundedRect(ctx, x, y, w, h, 22);
  ctx.fill();
  ctx.restore();
  return y + h;
}

/** Cream-dim inner card — like bg-cream-dim rounded-[18px] */
export function drawNestedCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.fillStyle = '#e8e2d4';
  drawRoundedRect(ctx, x, y, w, h, 18);
  ctx.fill();
}

/** Circle avatar with centered initial letter */
export function drawAvatar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  initial: string,
  bgColor: string,
  textColor: string,
): void {
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = textColor;
  ctx.font = `600 ${Math.round(radius * 0.9)}px 'Fraunces', Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initial, cx, cy);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/**
 * Draws two right-aligned currency conversion lines:
 *   ≈ $X.XX SGD
 *   1 SGD = Y.YYYYY [fromCurrency]
 *
 * @param rightEdge - x coordinate of the right edge (text is right-aligned to this)
 * @param y - baseline y of the first line; second line is drawn at y + lineH
 */
export function drawCurrencyConversionLines(
  ctx: CanvasRenderingContext2D,
  rightEdge: number,
  y: number,
  lineH: number,
  totalCents: number,
  conversionRate: number,
  fromCurrency: string,
): void {
  const sgdAmount = Math.round(totalCents * conversionRate);
  const rate = parseFloat((1 / conversionRate).toFixed(5));

  ctx.save();
  ctx.font = '400 18px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#5c5a55';
  ctx.textAlign = 'right';
  ctx.fillText(`≈ ${formatCurrencyFromCents(sgdAmount, BASE_CURRENCY)}`, rightEdge, y);
  ctx.fillText(`1 ${BASE_CURRENCY} = ${rate} ${fromCurrency}`, rightEdge, y + lineH);
  ctx.textAlign = 'left';
  ctx.restore();
}

export type LightTwoColumnRowArgs = {
  x: number;
  y: number;
  width: number;
  label: string;
  value: string;
  emphasized?: boolean;
  /** Override value color; defaults to `#1c1b1f` */
  valueColor?: string;
  /** Override label color; defaults to `#49454f` */
  labelColor?: string;
  size: number;
  italic?: boolean;
};

export function drawLightTwoColumnRow(
  ctx: CanvasRenderingContext2D,
  args: LightTwoColumnRowArgs,
): void {
  const style = args.italic ? 'italic ' : '';
  const weight = args.emphasized ? 700 : 400;
  const valueFont = `${style}${weight} ${args.size}px Inter, system-ui, sans-serif`;
  const labelFont = `${style}${weight} ${Math.max(14, args.size - 2)}px Inter, system-ui, sans-serif`;

  ctx.font = valueFont;
  const valueWidth = ctx.measureText(args.value).width;
  const labelMaxWidth = Math.max(80, args.width - valueWidth - 16);

  ctx.font = labelFont;
  ctx.fillStyle = args.labelColor ?? '#5c5a55';
  ctx.fillText(ellipsizeText(ctx, args.label, labelMaxWidth), args.x, args.y);

  ctx.font = valueFont;
  ctx.fillStyle = args.valueColor ?? '#0e0e0c';
  ctx.textAlign = 'right';
  ctx.fillText(args.value, args.x + args.width, args.y);
  ctx.textAlign = 'left';
}
