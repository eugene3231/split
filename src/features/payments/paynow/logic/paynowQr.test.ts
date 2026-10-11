import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generatePaynowQrDataUrls } from './paynowQr';

let shouldFailImageLoad = false;

class MockImage {
  onload: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  set src(_: string) {
    Promise.resolve().then(() => {
      if (shouldFailImageLoad) {
        this.onerror?.(new Error('image load failed'));
        return;
      }
      this.onload?.();
    });
  }
}

vi.mock('qrcode', () => ({
  default: {
    toCanvas: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.stubGlobal('Image', MockImage);

const makePeople = (names: string[]) => names.map((name, i) => ({ id: `p${i + 1}`, name }));

const makeSplit = (totalByPersonCents: Record<string, number>) => ({
  lineItemsByPerson: {},
  subtotalByPersonCents: totalByPersonCents,
  discountByPersonCents: {},
  serviceByPersonCents: {},
  gstByPersonCents: {},
  roundingByPersonCents: {},
  totalByPersonCents: totalByPersonCents,
  subtotalCents: Object.values(totalByPersonCents).reduce((s, v) => s + v, 0),
  discountCents: 0,
  serviceChargeCents: 0,
  gstCents: 0,
  roundingCents: 0,
  grandTotalCents: Object.values(totalByPersonCents).reduce((s, v) => s + v, 0),
  unassignedItemCount: 0,
  involvedCountByPerson: {},
});

describe('generatePaynowQrDataUrls', () => {
  beforeEach(() => {
    shouldFailImageLoad = false;
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/png;base64,mockqr',
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty object when payerMobile is invalid', async () => {
    const result = await generatePaynowQrDataUrls(
      makePeople(['Alice']),
      makeSplit({ p1: 1000 }),
      '',
    );
    expect(result).toEqual({});
  });

  it('returns empty string for person with zero amount', async () => {
    const result = await generatePaynowQrDataUrls(
      makePeople(['Alice', 'Bob']),
      makeSplit({ p1: 0, p2: 500 }),
      '+6591234567',
    );
    expect(result.p1).toBe('');
    expect(result.p2).toBe('data:image/png;base64,mockqr');
  });

  it('returns data URLs for people with positive amounts', async () => {
    const result = await generatePaynowQrDataUrls(
      makePeople(['Alice']),
      makeSplit({ p1: 1000 }),
      '+6591234567',
    );
    expect(result.p1).toBe('data:image/png;base64,mockqr');
  });

  it('still returns a QR data URL when the logo image fails to load', async () => {
    shouldFailImageLoad = true;

    const result = await generatePaynowQrDataUrls(
      makePeople(['Alice']),
      makeSplit({ p1: 1000 }),
      '+6591234567',
    );

    expect(result.p1).toBe('data:image/png;base64,mockqr');
  });

  it('returns empty string for person when QR generation fails', async () => {
    const { default: QRCode } = await import('qrcode');
    (QRCode.toCanvas as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('QR fail'));

    const result = await generatePaynowQrDataUrls(
      makePeople(['Alice']),
      makeSplit({ p1: 1000 }),
      '+6591234567',
    );
    expect(result.p1).toBe('');
  });

  it('writes who to pay and how much beside the code, not under it', async () => {
    const { default: QRCode } = await import('qrcode');
    (QRCode.toCanvas as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (canvas: HTMLCanvasElement, _value: string, { width }: { width: number }) => {
        canvas.width = width;
        canvas.height = width;
      },
    );
    const texts: { text: string; x: number }[] = [];
    const sizes: { width: number; height: number }[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(function (
      this: HTMLCanvasElement,
    ) {
      sizes.push({ width: this.width, height: this.height });
      return 'data:image/png;base64,mockqr';
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      measureText: (text: string) => ({ width: text.length * 10 }),
      fillText: (text: string, x: number) => texts.push({ text, x }),
    } as unknown as CanvasRenderingContext2D);
    await generatePaynowQrDataUrls(makePeople(['Alice']), makeSplit({ p1: 123450 }), '91234567');

    expect(sizes).toEqual([{ width: 160 + 16 + 130 + 8, height: 160 }]);
    expect(texts.map(({ text }) => text)).toEqual([
      'Pay to',
      '+65 9123 4567',
      'Amount',
      'SGD 1,234.50',
    ]);
    expect(texts.every(({ x }) => x > 160)).toBe(true);
  });
});
