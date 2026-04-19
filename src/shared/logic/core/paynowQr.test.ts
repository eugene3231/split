import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generatePaynowQrDataUrls } from '@shared/logic/core/paynowQr';

class MockImage {
  onload: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  set src(_: string) {
    Promise.resolve().then(() => this.onload?.());
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
  totalByPersonCents: totalByPersonCents,
  subtotalCents: Object.values(totalByPersonCents).reduce((s, v) => s + v, 0),
  discountCents: 0,
  serviceChargeCents: 0,
  gstCents: 0,
  grandTotalCents: Object.values(totalByPersonCents).reduce((s, v) => s + v, 0),
  unassignedItemCount: 0,
  involvedCountByPerson: {},
});

describe('generatePaynowQrDataUrls', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/png;base64,mockqr',
    );
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
});
