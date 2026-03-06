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
    ).toBe('Split total: S$37.50\nAlice: S$12.50\nBen: S$25.00')
  })
})

describe('getShareSupport', () => {
  it('returns native when navigator.share is available even when file sharing support is unknown', () => {
    expect(
      getShareSupport({
        share: vi.fn(),
        canShare: vi.fn(() => false),
        clipboard: {} as Navigator['clipboard'],
      }),
    ).toBe('native')
  })

  it('returns fallback when navigator.share is unavailable', () => {
    expect(getShareSupport(undefined)).toBe('fallback')
  })
})

describe('shareFinalSplit', () => {
  it('shares text only when canShare rejects files', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const canShare = vi.fn(() => false)

    const mode = await shareFinalSplit({
      text: 'Split total: S$0.00',
      image: new Blob(['image'], { type: 'image/png' }),
      fileName: 'split-final.png',
      navigator: {
        share,
        canShare,
        clipboard: {} as Navigator['clipboard'],
      },
    })

    expect(mode).toBe('native')
    expect(share).toHaveBeenCalledWith({
      text: 'Split total: S$0.00',
    })
  })

  it('retries with text-only share when share with files fails', async () => {
    const share = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('files not supported'))
      .mockResolvedValueOnce(undefined)
    const canShare = vi.fn(() => true)

    const mode = await shareFinalSplit({
      text: 'Split total: S$0.00',
      image: new Blob(['image'], { type: 'image/png' }),
      fileName: 'split-final.png',
      navigator: {
        share,
        canShare,
        clipboard: {} as Navigator['clipboard'],
      },
    })

    expect(mode).toBe('native')
    expect(share).toHaveBeenCalledTimes(2)
    expect(share).toHaveBeenLastCalledWith({
      text: 'Split total: S$0.00',
    })
  })
})
