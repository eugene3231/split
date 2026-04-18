import { describe, expect, it, vi } from 'vitest';
import {
  buildSplitShareText,
  copyShareText,
  getShareSupport,
  shareFinalSplit,
} from '@features/split-results/logic/shareSplit';

describe('buildSplitShareText', () => {
  it('formats a compact chat summary with the grand total and each person total', () => {
    expect(
      buildSplitShareText({
        people: [
          { id: 'p1', name: 'Alice' },
          { id: 'p2', name: 'Ben' },
        ],
        receiptName: 'Split',
        split: {
          lineItemsByPerson: {},
          subtotalByPersonCents: {},
          discountByPersonCents: {},
          serviceByPersonCents: {},
          gstByPersonCents: {},
          totalByPersonCents: {
            p1: 1250,
            p2: 2500,
          },
          subtotalCents: 0,
          discountCents: 0,
          serviceChargeCents: 0,
          gstCents: 0,
          grandTotalCents: 3750,
          unassignedItemCount: 0,
          involvedCountByPerson: {},
        },
      }),
    ).toBe('Split total: $37.50\n\nAlice: $12.50\nBen: $25.00');
  });
});

describe('getShareSupport', () => {
  it('returns native when navigator.share is available even when file sharing support is unknown', () => {
    expect(
      getShareSupport({
        share: vi.fn(),
        canShare: vi.fn(() => true),
        clipboard: {} as Navigator['clipboard'],
      }),
    ).toBe('native');
  });

  it('returns fallback when navigator.share is unavailable', () => {
    expect(getShareSupport(undefined)).toBe('fallback');
  });
});

describe('shareFinalSplit', () => {
  it('returns fallback when canShare rejects files', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn(() => false);

    const mode = await shareFinalSplit({
      image: new Blob(['image'], { type: 'image/png' }),
      fileName: 'split-final.png',
      navigator: {
        share,
        canShare,
        clipboard: {} as Navigator['clipboard'],
      },
    });

    expect(mode).toBe('fallback');
    expect(share).not.toHaveBeenCalled();
  });

  it('returns fallback when share with files fails', async () => {
    const share = vi.fn().mockRejectedValueOnce(new TypeError('files not supported'));
    const canShare = vi.fn(() => true);

    const mode = await shareFinalSplit({
      image: new Blob(['image'], { type: 'image/png' }),
      fileName: 'split-final.png',
      navigator: {
        share,
        canShare,
        clipboard: {} as Navigator['clipboard'],
      },
    });

    expect(mode).toBe('fallback');
    expect(share).toHaveBeenCalledTimes(1);
  });

  it('shares image file when supported', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn(() => true);

    const mode = await shareFinalSplit({
      image: new Blob(['image'], { type: 'image/png' }),
      fileName: 'split-final.png',
      navigator: {
        share,
        canShare,
        clipboard: {} as Navigator['clipboard'],
      },
    });

    expect(mode).toBe('native');
    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({
        files: expect.any(Array),
      }),
    );
  });

  it('returns fallback when navigator has no share function', async () => {
    const mode = await shareFinalSplit({
      image: new Blob(['image'], { type: 'image/png' }),
      fileName: 'split-final.png',
      navigator: {
        share: undefined as unknown as Navigator['share'],
        canShare: vi.fn(() => false),
        clipboard: {} as Navigator['clipboard'],
      },
    });
    expect(mode).toBe('fallback');
  });

  it('returns native when canShare is absent but share exists', () => {
    expect(
      getShareSupport({
        share: vi.fn(),
        canShare: undefined as unknown as Navigator['canShare'],
        clipboard: {} as Navigator['clipboard'],
      }),
    ).toBe('native');
  });

  it('re-throws AbortError from share', async () => {
    const share = vi.fn().mockRejectedValueOnce(new DOMException('User cancelled', 'AbortError'));
    const canShare = vi.fn(() => true);

    await expect(
      shareFinalSplit({
        image: new Blob(['image'], { type: 'image/png' }),
        fileName: 'split-final.png',
        navigator: {
          share,
          canShare,
          clipboard: {} as Navigator['clipboard'],
        },
      }),
    ).rejects.toThrow('User cancelled');
  });

  it('returns fallback when share throws non-AbortError', async () => {
    const share = vi.fn().mockRejectedValueOnce(new TypeError('Network error'));
    const canShare = vi.fn(() => true);

    const mode = await shareFinalSplit({
      image: new Blob(['image'], { type: 'image/png' }),
      fileName: 'split-final.png',
      navigator: {
        share,
        canShare,
        clipboard: {} as Navigator['clipboard'],
      },
    });
    expect(mode).toBe('fallback');
  });
});

describe('copyShareText', () => {
  it('throws when clipboard is not available', async () => {
    await expect(
      copyShareText('hello', {
        share: vi.fn(),
        canShare: vi.fn(() => false),
        clipboard: undefined as unknown as Navigator['clipboard'],
      }),
    ).rejects.toThrow('Copy is not available');
  });
});
