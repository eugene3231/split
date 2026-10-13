import { personColor } from '@shared/utils/personColors';
import { FONT, INK, MUTED } from '@features/sharing/logic/canvas/theme';

export function ellipsizeText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (context.measureText(text).width <= maxWidth) {
    return text;
  }

  const ellipsis = '...';
  let value = text;
  while (value.length > 0 && context.measureText(`${value}${ellipsis}`).width > maxWidth) {
    value = value.slice(0, -1);
  }

  return `${value}${ellipsis}`;
}

/**
 * Breaks text into lines no wider than maxWidth, at spaces where it can.
 * Anything past maxLines is cut short with an ellipsis on the last line.
 */
export function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  let rest = text.trim();
  while (rest && lines.length < maxLines - 1) {
    if (context.measureText(rest).width <= maxWidth) break;
    const words = rest.split(' ');
    let line = words[0];
    let taken = 1;
    while (
      taken < words.length &&
      context.measureText(`${line} ${words[taken]}`).width <= maxWidth
    ) {
      line = `${line} ${words[taken]}`;
      taken += 1;
    }
    if (context.measureText(line).width > maxWidth) {
      line = ellipsizeText(context, line, maxWidth).slice(0, -3);
      if (!line) break;
      rest = rest.slice(line.length).trim();
    } else {
      rest = words.slice(taken).join(' ');
    }
    lines.push(line);
  }
  if (rest) lines.push(ellipsizeText(context, rest, maxWidth));
  return lines;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to encode image.'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

export function formatGeneratedAt(date: Date): string {
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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

export function drawCardShell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.10)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.restore();
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
  ctx.font = `700 ${Math.round(args.radius * 0.9)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(args.name.trim().charAt(0).toUpperCase() || '?', args.cx, args.cy);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/** The image's heading, with when it was made underneath. `baseline` is the heading's. */
export function drawTitle(
  ctx: CanvasRenderingContext2D,
  title: string,
  x: number,
  baseline: number,
): void {
  ctx.fillStyle = INK;
  ctx.font = `700 44px ${FONT}`;
  ctx.fillText(title, x, baseline);

  ctx.fillStyle = MUTED;
  ctx.font = `500 22px ${FONT}`;
  ctx.fillText(`Generated ${formatGeneratedAt(new Date())}`, x, baseline + 36);
}
