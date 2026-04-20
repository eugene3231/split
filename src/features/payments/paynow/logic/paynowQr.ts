import type { Person, SplitResult } from '@shared/types';
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

function appendCaption(
  qrCanvas: HTMLCanvasElement,
  mobile: string,
  amountCents: number,
  scale: number,
): HTMLCanvasElement {
  // Stacked layout: small gray label on its own line, bold value below.
  // All pixel values are in canvas pixels (logical px × scale).
  const labelSize = Math.round(12 * scale);
  const valueSize = Math.round(16 * scale);
  const labelLineH = Math.round(17 * scale);
  const valueLineH = Math.round(23 * scale);
  const groupGap = Math.round(8 * scale);
  const padV = Math.round(10 * scale);

  const fields = [
    { label: 'Pay To', value: mobile },
    { label: 'Amount', value: `SGD ${(amountCents / 100).toFixed(2)}` },
  ];

  // padV + (labelLineH + valueLineH) per field + groupGap between fields + padV
  const captionH =
    padV + fields.length * (labelLineH + valueLineH) + (fields.length - 1) * groupGap + padV;
  const totalH = qrCanvas.height + captionH;

  const out = document.createElement('canvas');
  out.width = qrCanvas.width;
  out.height = totalH;

  const ctx = out.getContext('2d');
  if (!ctx) return qrCanvas;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, totalH);
  ctx.drawImage(qrCanvas, 0, 0);

  const centerX = out.width / 2;
  ctx.textAlign = 'center';
  let y = qrCanvas.height + padV;

  fields.forEach(({ label, value }, i) => {
    if (i > 0) y += groupGap;
    ctx.font = `${labelSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillStyle = '#888888';
    ctx.fillText(label, centerX, y + labelSize);
    y += labelLineH;
    ctx.font = `bold ${valueSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillStyle = '#111111';
    ctx.fillText(value, centerX, y + valueSize);
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
