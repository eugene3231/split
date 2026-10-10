import { useEffect, useRef } from 'react';
import { renderQrCanvas } from '../qr/logic/renderQrCanvas';
import { buildPaynowString } from '../paynow/logic/paynow';

interface PaynowQrProps {
  mobile: string;
  amountCents: number;
}

export function PaynowQr({ mobile, amountCents }: PaynowQrProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    void renderQrCanvas(buildPaynowString(mobile, amountCents), {
      canvas: canvasRef.current,
      size: 176,
      darkColor: '#7E197E',
      errorCorrectionLevel: 'Q',
    });
  }, [mobile, amountCents]);

  return <canvas ref={canvasRef} className="mx-auto rounded-lg" aria-label="PayNow QR code" />;
}
