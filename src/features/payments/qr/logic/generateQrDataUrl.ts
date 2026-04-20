import { renderQrCanvas } from './renderQrCanvas';

type GenerateQrDataUrlOptions = {
  size: number;
  margin?: number;
  darkColor?: string;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  mimeType?: string;
};

export async function generateQrDataUrl(
  value: string,
  { mimeType = 'image/png', ...options }: GenerateQrDataUrlOptions,
): Promise<string> {
  const canvas = await renderQrCanvas(value, options);
  return canvas.toDataURL(mimeType);
}
