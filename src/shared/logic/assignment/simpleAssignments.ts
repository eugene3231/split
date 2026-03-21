import type { EditableItem, Person } from '@shared/types'
import { createEmptyItem, sanitizeItemAssignment } from '@shared/logic/assignment/items'

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

export function syncItemsWithPeople(
  items: EditableItem[],
  people: Person[],
  uxMode: 'simple' | 'advanced',
): EditableItem[] {
  const sanitizedItems = items.map((item) => sanitizeItemAssignment(item, people))
  if (uxMode !== 'simple' || people.length === 0) {
    return sanitizedItems
  }

  return convertItemsToSimpleEqualMode(sanitizedItems, people)
}

export function buildInitialItems(
  items: EditableItem[],
  people: Person[],
  uxMode: 'simple' | 'advanced',
): EditableItem[] {
  if (items.length === 0) {
    return [uxMode === 'simple' ? createSimpleEmptyItem(people) : createEmptyItem(people)]
  }

  return syncItemsWithPeople(items, people, uxMode)
}
