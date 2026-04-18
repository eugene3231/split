import { describe, expect, it, vi } from 'vitest';
import {
  buildSplitShareText,
  copyShareText,
  getShareSupport,
  shareText,
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
  it('returns native when navigator.share is available', () => {
    expect(
      getShareSupport({
        share: vi.fn(),
        canShare: vi.fn(() => true),
        clipboard: {} as Navigator['clipboard'],
      }),
    ).toBe('native');
  });

  it('returns native when navigator.share exists but canShare is absent', () => {
    expect(
      getShareSupport({
        share: vi.fn(),
        canShare: undefined as unknown as Navigator['canShare'],
        clipboard: {} as Navigator['clipboard'],
      }),
    ).toBe('native');
  });

  it('returns fallback when navigator.share is unavailable', () => {
    expect(getShareSupport(undefined)).toBe('fallback');
  });
});

describe('shareText', () => {
  it('calls navigator.share with text and returns native', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);

    const result = await shareText('hello', {
      share,
      canShare: vi.fn(),
      clipboard: { writeText } as unknown as Navigator['clipboard'],
    });

    expect(result).toBe('native');
    expect(share).toHaveBeenCalledWith({ text: 'hello' });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('falls back to clipboard when navigator.share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    const result = await shareText('hello', {
      share: undefined as unknown as Navigator['share'],
      canShare: vi.fn(),
      clipboard: { writeText } as unknown as Navigator['clipboard'],
    });

    expect(result).toBe('fallback');
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('re-throws AbortError', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('User cancelled', 'AbortError'));

    await expect(
      shareText('hello', {
        share,
        canShare: vi.fn(),
        clipboard: {} as Navigator['clipboard'],
      }),
    ).rejects.toThrow('User cancelled');
  });

  it('falls back to clipboard when share throws non-AbortError', async () => {
    const share = vi.fn().mockRejectedValue(new TypeError('not supported'));
    const writeText = vi.fn().mockResolvedValue(undefined);

    const result = await shareText('hello', {
      share,
      canShare: vi.fn(),
      clipboard: { writeText } as unknown as Navigator['clipboard'],
    });

    expect(result).toBe('fallback');
    expect(writeText).toHaveBeenCalledWith('hello');
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
