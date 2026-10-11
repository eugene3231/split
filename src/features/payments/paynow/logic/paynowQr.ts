import type { Person, SplitResult } from '@shared/types';
import { formatMoneyAmount } from '@shared/logic/core/money';
import { renderQrCanvas } from '@features/payments/qr/logic/renderQrCanvas';
import { buildPaynowString, normalizeMobile } from './paynow';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function overlayLogo(canvas: HTMLCanvasElement, logo: HTMLImageElement, canvasSize: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  // Logo height = 22% of canvas, width maintains the PayNow wordmark's 40:26 aspect ratio.
  // All sizes are in canvas pixels, so they scale correctly with canvasSize.
  const logoH = canvasSize * 0.25;
  const logoW = logoH * (40 / 26);
  const pad = Math.round(canvasSize * 0.005);
  const bgW = logoW + pad * 2;
  const bgH = logoH + pad * 2;
  const x = (canvasSize - bgW) / 2;
  const y = (canvasSize - bgH) / 2;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, bgW, bgH);
  ctx.drawImage(logo, x + pad, y + pad, logoW, logoH);
}

const CAPTION_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/** "+6591234567" reads as "+65 9123 4567". */
function formatMobile(mobile: string): string {
  return mobile.replace(/^(\+65)(\d{4})(\d{4})$/, '$1 $2 $3');
}

/**
 * Puts "Pay to" and "Amount" beside the code rather than under it, so the image sits on
 * one short row at the bottom of a card instead of a tall column with space either side.
 */
function appendCaption(
  qrCanvas: HTMLCanvasElement,
  mobile: string,
  amountCents: number,
  scale: number,
): HTMLCanvasElement {
  // All pixel values are in canvas pixels (logical px × scale).
  const labelSize = Math.round(13 * scale);
  const valueSize = Math.round(20 * scale);
  const labelLineH = Math.round(18 * scale);
  const valueLineH = Math.round(28 * scale);
  const groupGap = Math.round(12 * scale);
  const gap = Math.round(16 * scale);
  const padRight = Math.round(8 * scale);

  const fields = [
    { label: 'Pay to', value: formatMobile(mobile) },
    { label: 'Amount', value: `SGD ${formatMoneyAmount(amountCents, 'SGD')}` },
  ];

  const out = document.createElement('canvas');
  const ctx = out.getContext('2d');
  if (!ctx) return qrCanvas;

  ctx.font = `bold ${valueSize}px ${CAPTION_FONT}`;
  const textWidth = Math.max(...fields.map(({ value }) => ctx.measureText(value).width));
  out.width = qrCanvas.width + gap + Math.ceil(textWidth) + padRight;
  out.height = qrCanvas.height;

  // Resizing reset the context, so the fill and fonts are set after it.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(qrCanvas, 0, 0);

  const textH = fields.length * (labelLineH + valueLineH) + (fields.length - 1) * groupGap;
  const x = qrCanvas.width + gap;
  let y = (out.height - textH) / 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  fields.forEach(({ label, value }, i) => {
    if (i > 0) y += groupGap;
    ctx.font = `${labelSize}px ${CAPTION_FONT}`;
    ctx.fillStyle = '#71717a';
    ctx.fillText(label, x, y);
    y += labelLineH;
    ctx.font = `bold ${valueSize}px ${CAPTION_FONT}`;
    ctx.fillStyle = '#111111';
    ctx.fillText(value, x, y);
    y += valueLineH;
  });

  return out;
}

export async function generatePaynowQrDataUrls(
  people: Person[],
  split: SplitResult,
  payerMobile: string,
  qrSize = 160,
): Promise<Record<string, string>> {
  const normalised = normalizeMobile(payerMobile);
  if (!normalised) return {};

  const logo = await loadImage('/paynow-logo.svg').catch(() => null);

  const entries = await Promise.all(
    people.map(async (person) => {
      const amountCents = split.totalByPersonCents[person.id] ?? 0;
      if (amountCents <= 0) return [person.id, ''] as const;
      try {
        const paynowStr = buildPaynowString(normalised, amountCents);
        // Render at device pixel density so the data URL is sharp on retina screens.
        const scale = Math.ceil(window.devicePixelRatio ?? 2);
        const internalSize = qrSize * scale;
        const canvas = await renderQrCanvas(paynowStr, {
          canvas: document.createElement('canvas'),
          errorCorrectionLevel: 'Q',
          size: internalSize,
          margin: 1,
          darkColor: '#7E197E',
        });
        if (logo) overlayLogo(canvas, logo, internalSize);
        const final = appendCaption(canvas, normalised, amountCents, scale);
        return [person.id, final.toDataURL('image/png')] as const;
      } catch {
        return [person.id, ''] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}
