// Shared canvas drawing utilities for receipt split image generators

export const CANVAS_WIDTH = 1800;
export const SCRATCH_HEIGHT = 24000;

// Plate palette — matches personColors.ts oklch-based colors
const PERSON_CANVAS_COLORS = [
  {
    headerBg: 'rgba(197, 74, 47, 0.15)',
    headerBorder: 'rgba(197, 74, 47, 0.5)',
    accent: '#c54a2f',
  }, // tomato
  {
    headerBg: 'rgba(42, 115, 56, 0.15)',
    headerBorder: 'rgba(42, 115, 56, 0.5)',
    accent: '#2a7338',
  }, // basil
  {
    headerBg: 'rgba(184, 116, 32, 0.15)',
    headerBorder: 'rgba(184, 116, 32, 0.5)',
    accent: '#b87420',
  }, // citrus
  {
    headerBg: 'rgba(51, 85, 152, 0.15)',
    headerBorder: 'rgba(51, 85, 152, 0.5)',
    accent: '#335598',
  }, // mineral
  {
    headerBg: 'rgba(122, 61, 170, 0.15)',
    headerBorder: 'rgba(122, 61, 170, 0.5)',
    accent: '#7a3daa',
  }, // purple
  {
    headerBg: 'rgba(26, 122, 106, 0.15)',
    headerBorder: 'rgba(26, 122, 106, 0.5)',
    accent: '#1a7a6a',
  }, // teal
  {
    headerBg: 'rgba(184, 120, 40, 0.15)',
    headerBorder: 'rgba(184, 120, 40, 0.5)',
    accent: '#b87828',
  }, // amber
  {
    headerBg: 'rgba(80, 64, 160, 0.15)',
    headerBorder: 'rgba(80, 64, 160, 0.5)',
    accent: '#5040a0',
  }, // indigo
];

export function getPersonCanvasColor(index: number) {
  return PERSON_CANVAS_COLORS[index % PERSON_CANVAS_COLORS.length];
}

export function drawCardShell(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  context.fillStyle = '#0b1220';
  context.fillRect(x, y, width, height);
  context.strokeStyle = '#1e293b';
  context.lineWidth = 2;
  context.strokeRect(x, y, width, height);
  return y + height;
}

export type TwoColumnRowArgs = {
  x: number;
  y: number;
  width: number;
  label: string;
  value: string;
  emphasized: boolean;
  valueColor: string;
  size: number;
  italic?: boolean;
};

export function drawTwoColumnRow(context: CanvasRenderingContext2D, args: TwoColumnRowArgs): void {
  const style = args.italic ? 'italic ' : '';
  const valueFont = `${style}${args.emphasized ? 700 : 600} ${args.size}px system-ui, -apple-system, sans-serif`;
  const labelFont = `${style}500 ${Math.max(15, args.size - 2)}px system-ui, -apple-system, sans-serif`;

  context.font = valueFont;
  const valueWidth = context.measureText(args.value).width;

  const valueX = args.x + args.width;
  const labelMaxWidth = Math.max(80, args.width - valueWidth - 16);

  context.font = labelFont;
  context.fillStyle = '#94a3b8';
  context.fillText(ellipsizeText(context, args.label, labelMaxWidth), args.x, args.y);

  context.font = valueFont;
  context.fillStyle = args.valueColor;
  context.textAlign = 'right';
  context.fillText(args.value, valueX, args.y);
  context.textAlign = 'left';
}

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

export function formatPercent(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '');
}
