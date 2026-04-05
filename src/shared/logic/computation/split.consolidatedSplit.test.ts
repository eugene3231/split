import { describe, expect, it } from 'vitest'
import type { ChargeState, EditableItem, Person } from '@shared/types'
import { computeSplit, computeConsolidatedSplit } from '@shared/logic/computation/split'
import { BASE_CURRENCY } from '@shared/constants'

const disabled: ChargeState = {
  enabled: false, mode: 'percent', amountInput: '', percentInput: '',
  detectedConfidence: null, detectedSource: null,
}

const people: Person[] = [
  { id: 'alice', name: 'Alice' },
  { id: 'bob', name: 'Bob' },
]

function makeItem(id: string, amount: string, personId: string): EditableItem {
  return {
    id,
    name: `Item ${id}`,
    amountInput: amount,
    discountPercentInput: '',
    assignment: { mode: 'single', personId, personIds: [personId] },
  }
}

// ─── Same-currency consolidation (original behaviour) ─────────────────────────

describe('computeConsolidatedSplit — same currency', () => {
  it('sums totals across two SGD receipts without conversion', () => {
    const split1 = computeSplit({
      people,
      items: [makeItem('i1', '10.00', 'alice')],
      discount: disabled, serviceCharge: disabled, gst: disabled,
    })
    const split2 = computeSplit({
      people,
      items: [makeItem('i2', '20.00', 'bob')],
      discount: disabled, serviceCharge: disabled, gst: disabled,
    })

    const consolidated = computeConsolidatedSplit(
      [split1, split2],
      people,
      ['SGD', 'SGD'],
      { SGD: 1 },
      [null, null],
      BASE_CURRENCY,
    )

    expect(consolidated.grandTotalCents).toBe(3000)
    expect(consolidated.totalByPersonCents.alice).toBe(1000)
    expect(consolidated.totalByPersonCents.bob).toBe(2000)
  })
})

// ─── Multi-currency consolidation ─────────────────────────────────────────────

describe('computeConsolidatedSplit — multi-currency', () => {
  const rates = { SGD: 1, USD: 1.35, THB: 0.038 }

  it('converts a USD receipt to SGD before summing with a SGD receipt', () => {
    // Receipt 1: SGD $10 for Alice
    const sgdSplit = computeSplit({
      people,
      items: [makeItem('i1', '10.00', 'alice')],
      discount: disabled, serviceCharge: disabled, gst: disabled,
    })

    // Receipt 2: USD $20 for Bob → 2000 USD cents * 1.35 = 2700 SGD cents
    const usdSplit = computeSplit({
      people,
      items: [makeItem('i2', '20.00', 'bob')],
      discount: disabled, serviceCharge: disabled, gst: disabled,
    })

    const consolidated = computeConsolidatedSplit(
      [sgdSplit, usdSplit],
      people,
      ['SGD', 'USD'],
      rates,
      [null, null],
      BASE_CURRENCY,
    )

    // Alice: 1000 SGD cents (no conversion)
    expect(consolidated.totalByPersonCents.alice).toBe(1000)
    // Bob: 2000 USD cents * 1.35 = 2700 SGD cents
    expect(consolidated.totalByPersonCents.bob).toBe(2700)
    // Grand total: 1000 + 2700 = 3700 SGD cents
    expect(consolidated.grandTotalCents).toBe(3700)
  })

  it('converts THB receipt to SGD correctly', () => {
    // THB receipt: 10000 THB cents (100 THB) for Alice
    const thbSplit = computeSplit({
      people,
      items: [makeItem('i1', '100.00', 'alice')],
      discount: disabled, serviceCharge: disabled, gst: disabled,
    })
    // 10000 THB cents * 0.038 = 380 SGD cents

    const consolidated = computeConsolidatedSplit(
      [thbSplit],
      people,
      ['THB'],
      rates,
      [null],
      BASE_CURRENCY,
    )

    expect(consolidated.totalByPersonCents.alice).toBe(380)
    expect(consolidated.grandTotalCents).toBe(380)
  })

  it('applies user exchange rate override instead of auto rate', () => {
    // USD receipt: 1000 USD cents for Alice
    const usdSplit = computeSplit({
      people,
      items: [makeItem('i1', '10.00', 'alice')],
      discount: disabled, serviceCharge: disabled, gst: disabled,
    })

    // Auto rate is 1.35, but user overrides to 1.50
    const withAutoRate = computeConsolidatedSplit(
      [usdSplit], people, ['USD'], rates, [null], BASE_CURRENCY,
    )
    const withOverride = computeConsolidatedSplit(
      [usdSplit], people, ['USD'], rates, [1.50], BASE_CURRENCY,
    )

    expect(withAutoRate.totalByPersonCents.alice).toBe(1350) // 1000 * 1.35
    expect(withOverride.totalByPersonCents.alice).toBe(1500) // 1000 * 1.50
  })

  it('handles three receipts with three different currencies', () => {
    const sgdSplit = computeSplit({
      people,
      items: [makeItem('i1', '10.00', 'alice')],
      discount: disabled, serviceCharge: disabled, gst: disabled,
    })
    const usdSplit = computeSplit({
      people,
      items: [makeItem('i2', '10.00', 'alice')],
      discount: disabled, serviceCharge: disabled, gst: disabled,
    })
    const thbSplit = computeSplit({
      people,
      items: [makeItem('i3', '100.00', 'alice')],
      discount: disabled, serviceCharge: disabled, gst: disabled,
    })

    // SGD: 1000 cents
    // USD: 1000 cents * 1.35 = 1350 SGD cents
    // THB: 10000 cents * 0.038 = 380 SGD cents
    // Total: 1000 + 1350 + 380 = 2730 SGD cents

    const consolidated = computeConsolidatedSplit(
      [sgdSplit, usdSplit, thbSplit],
      people,
      ['SGD', 'USD', 'THB'],
      rates,
      [null, null, null],
      BASE_CURRENCY,
    )

    expect(consolidated.totalByPersonCents.alice).toBe(2730)
    expect(consolidated.grandTotalCents).toBe(2730)
  })

  it('defaults to base currency when currencies array is shorter than results', () => {
    const split1 = computeSplit({
      people,
      items: [makeItem('i1', '10.00', 'alice')],
      discount: disabled, serviceCharge: disabled, gst: disabled,
    })
    const split2 = computeSplit({
      people,
      items: [makeItem('i2', '10.00', 'bob')],
      discount: disabled, serviceCharge: disabled, gst: disabled,
    })

    // currencies array is shorter — second receipt defaults to SGD (no conversion)
    const consolidated = computeConsolidatedSplit(
      [split1, split2],
      people,
      ['SGD'],   // missing second entry
      { SGD: 1 },
      [],
      BASE_CURRENCY,
    )

    expect(consolidated.grandTotalCents).toBe(2000)
  })

  it('sums charges across receipts after currency conversion', () => {
    const serviceCharge: ChargeState = {
      enabled: true, mode: 'percent', amountInput: '', percentInput: '10',
      detectedConfidence: null, detectedSource: null,
    }

    // USD receipt: 10000 USD cents ($100 USD), 10% service = 1000 USD cents service
    const usdSplit = computeSplit({
      people,
      items: [makeItem('i1', '100.00', 'alice')],
      discount: disabled, serviceCharge, gst: disabled,
    })

    // 10000 USD subtotal * 1.35 = 13500 SGD cents
    // 1000 USD service * 1.35 = 1350 SGD cents
    const consolidated = computeConsolidatedSplit(
      [usdSplit], people, ['USD'], rates, [null], BASE_CURRENCY,
    )

    expect(consolidated.subtotalCents).toBe(13500)
    expect(consolidated.serviceChargeCents).toBe(1350)
    expect(consolidated.grandTotalCents).toBe(14850)
  })

  it('accumulates unassigned item count without currency conversion', () => {
    const split1 = computeSplit({
      people,
      items: [{
        id: 'i1', name: 'Unassigned', amountInput: '5.00', discountPercentInput: '',
        assignment: { mode: 'single', personId: '', personIds: [] },
      }],
      discount: disabled, serviceCharge: disabled, gst: disabled,
    })
    const split2 = computeSplit({
      people,
      items: [{
        id: 'i2', name: 'Also unassigned', amountInput: '5.00', discountPercentInput: '',
        assignment: { mode: 'single', personId: '', personIds: [] },
      }],
      discount: disabled, serviceCharge: disabled, gst: disabled,
    })

    const consolidated = computeConsolidatedSplit(
      [split1, split2], people, ['SGD', 'USD'], rates, [null, null], BASE_CURRENCY,
    )

    expect(consolidated.unassignedItemCount).toBe(2)
  })
})
