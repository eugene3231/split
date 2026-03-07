import { describe, expect, it, vi } from 'vitest'
import { buildSplitShareText, getShareSupport, shareFinalSplit } from './shareSplit'

describe('buildSplitShareText', () => {
  it('formats a compact chat summary with the grand total and each person total', () => {
    expect(
      buildSplitShareText({
        people: [
          { id: 'p1', name: 'Alice' },
          { id: 'p2', name: 'Ben' },
        ],
        split: {
          lineItemsByPerson: {},
          subtotalByPersonCents: {},
          serviceByPersonCents: {},
          gstByPersonCents: {},
          totalByPersonCents: {
            p1: 1250,
            p2: 2500,
          },
          subtotalCents: 0,
          serviceChargeCents: 0,
          gstCents: 0,
          grandTotalCents: 3750,
          unassignedItemCount: 0,
        },
      }),
    ).toBe('Split total: $37.50\nAlice: $12.50\nBen: $25.00')
  })
})

describe('getShareSupport', () => {
  it('returns native when navigator.share is available even when file sharing support is unknown', () => {
    expect(
      getShareSupport({
        share: vi.fn(),
        canShare: vi.fn(() => true),
        clipboard: {} as Navigator['clipboard'],
      }),
    ).toBe('native')
  })

  it('returns fallback when navigator.share is unavailable', () => {
    expect(getShareSupport(undefined)).toBe('fallback')
  })
})

describe('shareFinalSplit', () => {
  it('returns fallback when canShare rejects files', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const canShare = vi.fn(() => false)

    const mode = await shareFinalSplit({
      image: new Blob(['image'], { type: 'image/png' }),
      fileName: 'split-final.png',
      navigator: {
        share,
        canShare,
        clipboard: {} as Navigator['clipboard'],
      },
    })

    expect(mode).toBe('fallback')
    expect(share).not.toHaveBeenCalled()
  })

  it('returns fallback when share with files fails', async () => {
    const share = vi.fn().mockRejectedValueOnce(new TypeError('files not supported'))
    const canShare = vi.fn(() => true)

    const mode = await shareFinalSplit({
      image: new Blob(['image'], { type: 'image/png' }),
      fileName: 'split-final.png',
      navigator: {
        share,
        canShare,
        clipboard: {} as Navigator['clipboard'],
      },
    })

    expect(mode).toBe('fallback')
    expect(share).toHaveBeenCalledTimes(1)
  })

  it('shares image file when supported', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const canShare = vi.fn(() => true)

    const mode = await shareFinalSplit({
      image: new Blob(['image'], { type: 'image/png' }),
      fileName: 'split-final.png',
      navigator: {
        share,
        canShare,
        clipboard: {} as Navigator['clipboard'],
      },
    })

    expect(mode).toBe('native')
    expect(share).toHaveBeenCalledTimes(1)
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({
        files: expect.any(Array),
      }),
    )
  })
})
