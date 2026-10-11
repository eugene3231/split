import { formatCurrencyFromCents, formatExchangeRate } from '@shared/logic/core/money';
import { personColor } from '@shared/utils/personColors';
import type { BreakdownConversion, BreakdownExchangeRate } from '@shared/types/summaryBreakdown';

export {
  canvasToBlob,
  formatGeneratedAt,
  ellipsizeText,
  wrapText,
} from '@features/sharing/logic/receiptSplitImageHelpers';

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

export function drawLightCardShell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): number {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.10)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.restore();
  return y + h;
}

export interface PersonAvatarArgs {
  cx: number;
  cy: number;
  radius: number;
  name: string;
  colorIndex: number;
}

/** Mirrors `PersonAvatar`: person colour fill, white initial. */
export function drawPersonAvatar(ctx: CanvasRenderingContext2D, args: PersonAvatarArgs): void {
  ctx.fillStyle = personColor(args.colorIndex);
  ctx.beginPath();
  ctx.arc(args.cx, args.cy, args.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(args.radius * 0.9)}px Inter, system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(args.name.trim().charAt(0).toUpperCase() || '?', args.cx, args.cy);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/** The `≈ SGD` amount, then the rate unless the breakdown says it is already shown above. */
export function formatConversionLines(conversion: BreakdownConversion): string[] {
  const amount = `≈ ${formatCurrencyFromCents(conversion.amountCents, conversion.toCurrency)}`;
  return conversion.showRate ? [amount, formatRateLine(conversion)] : [amount];
}

export function formatRateLine(rate: BreakdownExchangeRate): string {
  return `1 ${rate.toCurrency} = ${formatExchangeRate(1 / rate.rate)} ${rate.fromCurrency}`;
}
