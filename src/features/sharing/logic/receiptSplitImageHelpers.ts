// Shared canvas drawing utilities for receipt split image generators

export const CANVAS_WIDTH = 1800;
export const SCRATCH_HEIGHT = 24000;

// Raw canvas equivalents of PERSON_COLORS from personColors.ts
const PERSON_CANVAS_COLORS = [
  {
    headerBg: 'rgba(6, 182, 212, 0.15)',
    headerBorder: 'rgba(6, 182, 212, 0.5)',
    accent: '#67e8f9',
  }, // cyan
  {
    headerBg: 'rgba(139, 92, 246, 0.15)',
    headerBorder: 'rgba(139, 92, 246, 0.5)',
    accent: '#c4b5fd',
  }, // violet
  {
    headerBg: 'rgba(251, 191, 36, 0.15)',
    headerBorder: 'rgba(251, 191, 36, 0.5)',
    accent: '#fcd34d',
  }, // amber
  {
    headerBg: 'rgba(16, 185, 129, 0.15)',
    headerBorder: 'rgba(16, 185, 129, 0.5)',
    accent: '#6ee7b7',
  }, // emerald
  {
    headerBg: 'rgba(244, 63, 94, 0.15)',
    headerBorder: 'rgba(244, 63, 94, 0.5)',
    accent: '#fda4af',
  }, // rose
  {
    headerBg: 'rgba(249, 115, 22, 0.15)',
    headerBorder: 'rgba(249, 115, 22, 0.5)',
    accent: '#fdba74',
  }, // orange
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
