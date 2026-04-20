import QRCode from 'qrcode';

type RenderQrCanvasOptions = {
  canvas?: HTMLCanvasElement;
  size: number;
  margin?: number;
  darkColor?: string;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
};

export async function renderQrCanvas(
  value: string,
  {
    canvas = document.createElement('canvas'),
    size,
    margin = 1,
    darkColor = '#000000',
    errorCorrectionLevel = 'M',
  }: RenderQrCanvasOptions,
): Promise<HTMLCanvasElement> {
  await QRCode.toCanvas(canvas, value, {
    errorCorrectionLevel,
    width: size,
    margin,
    color: { dark: darkColor },
  });

  return canvas;
}
