import { describe, expect, it } from 'vitest'
import type { ChargeState, EditableItem, Person } from '../../types'
import { computeSplit } from './split'

const disabledCharge: ChargeState = {
  enabled: false,
  mode: 'percent',
  amountInput: '',
  percentInput: '',
  detectedConfidence: null,
  detectedSource: null,
}

describe('computeSplit', () => {
  it('allocates equal split remainders deterministically', () => {
    const people: Person[] = [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Ben' },
      { id: 'p3', name: 'Cara' },
    ]

    const items: EditableItem[] = [
      {
        id: 'item-1',
        name: 'Shared fries',
        amountInput: '10.00',
        discountPercentInput: '',
        assignment: {
          mode: 'equal',
          personId: '',
          personIds: ['p1', 'p2', 'p3'],
        },
      },
    ]

    const split = computeSplit({
      people,
      items,
      serviceCharge: disabledCharge,
      gst: disabledCharge,
    })

    expect(split.subtotalCents).toBe(1000)
    expect(split.subtotalByPersonCents).toEqual({
      p1: 334,
      p2: 333,
      p3: 333,
    })
    expect(split.grandTotalCents).toBe(1000)
    expect(split.totalByPersonCents).toEqual({
      p1: 334,
      p2: 333,
      p3: 333,
    })
    expect(split.lineItemsByPerson.p1[0]?.assignedAmountCents).toBe(334)
    expect(split.lineItemsByPerson.p2[0]?.assignedAmountCents).toBe(333)
    expect(split.lineItemsByPerson.p3[0]?.assignedAmountCents).toBe(333)
  })

  it('excludes unassigned items and counts them', () => {
    const people: Person[] = [{ id: 'p1', name: 'Alice' }]

    const items: EditableItem[] = [
      {
        id: 'item-1',
        name: 'Assigned',
        amountInput: '5.00',
        discountPercentInput: '',
        assignment: {
          mode: 'single',
          personId: 'p1',
          personIds: ['p1'],
        },
      },
      {
        id: 'item-2',
        name: 'Invalid single assignee',
        amountInput: '10.00',
        discountPercentInput: '',
        assignment: {
          mode: 'single',
          personId: 'missing',
          personIds: [],
        },
      },
      {
        id: 'item-3',
        name: 'Empty equal split',
        amountInput: '2.00',
        discountPercentInput: '',
        assignment: {
          mode: 'equal',
          personId: '',
          personIds: [],
        },
      },
      {
        id: 'item-4',
        name: 'Invalid amount',
        amountInput: '',
        discountPercentInput: '',
        assignment: {
          mode: 'single',
          personId: 'missing',
          personIds: [],
        },
      },
    ]

    const split = computeSplit({
      people,
      items,
      serviceCharge: disabledCharge,
      gst: disabledCharge,
    })

    expect(split.unassignedItemCount).toBe(2)
    expect(split.subtotalCents).toBe(500)
    expect(split.grandTotalCents).toBe(500)
    expect(split.subtotalByPersonCents.p1).toBe(500)
    expect(split.lineItemsByPerson.p1).toHaveLength(1)
  })
})
