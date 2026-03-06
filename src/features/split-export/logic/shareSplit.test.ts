import { describe, expect, it } from 'vitest'
import { buildSplitShareText } from './shareSplit'

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
