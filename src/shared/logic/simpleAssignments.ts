import type { EditableItem, Person } from '../types'
import { createEmptyItem } from './assignment/items'

export function createSimpleEmptyItem(people: Person[]): EditableItem {
  const baseItem = createEmptyItem(people)
  return {
    ...baseItem,
    assignment: {
      mode: 'equal',
      personId: '',
      personIds: people.map((person) => person.id),
    },
  }
}

export function buildNewSimpleItem(people: Person[]): EditableItem {
  return createSimpleEmptyItem(people)
}

export function convertItemsToSimpleEqualMode(items: EditableItem[], people: Person[]): EditableItem[] {
  const personIds = people.map((person) => person.id)
  const validPeople = new Set(personIds)

  return items.map((item) => {
    const filteredIds = Array.from(
      new Set(item.assignment.personIds.filter((personId) => validPeople.has(personId))),
    )
    const nextPersonIds = item.assignment.mode === 'equal' ? filteredIds : personIds

    return {
      ...item,
      assignment: {
        mode: 'equal',
        personId: '',
        personIds: nextPersonIds,
      },
    }
  })
}
