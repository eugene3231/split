// Shared canvas drawing utilities for receipt split image generators

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
