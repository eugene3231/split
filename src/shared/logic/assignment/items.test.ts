import { describe, expect, it } from 'vitest'
import type { EditableItem, Person } from '@shared/types'
import {
  createEmptyItem,
  isItemAssigned,
  pickDefaultPersonId,
  sanitizeItemAssignment,
} from '@shared/logic/assignment/items'

const people: Person[] = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
]

function buildItem(overrides: Partial<EditableItem> = {}): EditableItem {
  return {
    id: 'item-1',
    name: 'Noodles',
    amountInput: '10.00',
    discountPercentInput: '',
    assignment: {
      mode: 'single',
      personId: 'p1',
      personIds: ['p1', 'p2'],
    },
    ...overrides,
  }
}

describe('createEmptyItem', () => {
  it('defaults to first person for single mode and all person ids for equal mode selection state', () => {
    const item = createEmptyItem(people)
    expect(item.assignment.mode).toBe('single')
    expect(item.assignment.personId).toBe('p1')
    expect(item.assignment.personIds).toEqual(['p1', 'p2'])
  })
})

describe('sanitizeItemAssignment', () => {
  it('replaces invalid single assignment with first available person', () => {
    const item = buildItem({
      assignment: {
        mode: 'single',
        personId: 'missing',
        personIds: ['p1', 'p2'],
      },
    })

    const next = sanitizeItemAssignment(item, people)
    expect(next.assignment.personId).toBe('p1')
  })

  it('keeps valid single assignment unchanged', () => {
    const item = buildItem({
      assignment: {
        mode: 'single',
        personId: 'p2',
        personIds: ['p1', 'p2'],
      },
    })

    const next = sanitizeItemAssignment(item, people)
    expect(next).toBe(item)
  })

  it('filters invalid and duplicate equal-split ids without changing valid ids', () => {
    const item = buildItem({
      assignment: {
        mode: 'equal',
        personId: 'p1',
        personIds: ['p2', 'missing', 'p2', 'p1'],
      },
    })

    const next = sanitizeItemAssignment(item, people)
    expect(next.assignment.personIds).toEqual(['p2', 'p1'])
  })
})

describe('pickDefaultPersonId', () => {
  it('returns candidate if valid, otherwise first person or empty string', () => {
    expect(pickDefaultPersonId(people, 'p2')).toBe('p2')
    expect(pickDefaultPersonId(people, 'missing')).toBe('p1')
    expect(pickDefaultPersonId([], 'missing')).toBe('')
  })
})

describe('isItemAssigned', () => {
  it('supports single and equal assignment checks', () => {
    const peopleSet = new Set(['p1', 'p2'])
    expect(
      isItemAssigned(
        buildItem({
          assignment: {
            mode: 'single',
            personId: 'p1',
            personIds: [],
          },
        }),
        peopleSet,
      ),
    ).toBe(true)

    expect(
      isItemAssigned(
        buildItem({
          assignment: {
            mode: 'equal',
            personId: '',
            personIds: ['missing', 'p2'],
          },
        }),
        peopleSet,
      ),
    ).toBe(true)
  })
})
