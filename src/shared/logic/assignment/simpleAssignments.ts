import type { EditableItem, Person } from '@shared/types';
import { createId } from '@shared/logic/core/id';
import { sanitizeItemAssignment } from '@shared/logic/assignment/items';

export function createDefaultItem(people: Person[]): EditableItem {
  const baseItem = {
    id: createId(),
    name: '',
    amountInput: '',
    discountPercentInput: '',
    assignment: {
      mode: 'equal' as const,
      personId: '',
      personIds: people.map((person) => person.id),
    },
  };
  return baseItem;
}

export function convertItemsToSimpleEqualMode(
  items: EditableItem[],
  people: Person[],
): EditableItem[] {
  const personIds = people.map((person) => person.id);
  const validPeople = new Set(personIds);

  return items.map((item) => {
    const filteredIds = Array.from(
      new Set(item.assignment.personIds.filter((personId) => validPeople.has(personId))),
    );
    const nextPersonIds = item.assignment.mode === 'equal' ? filteredIds : personIds;

    return {
      ...item,
      assignment: {
        mode: 'equal' as const,
        personId: '',
        personIds: nextPersonIds,
      },
    };
  });
}

export function syncItemsWithPeople(items: EditableItem[], people: Person[]): EditableItem[] {
  const sanitizedItems = items.map((item) => sanitizeItemAssignment(item, people));
  if (people.length === 0) {
    return sanitizedItems;
  }

  return convertItemsToSimpleEqualMode(sanitizedItems, people);
}

export function buildInitialItems(items: EditableItem[], people: Person[]): EditableItem[] {
  if (items.length === 0) {
    return [createDefaultItem(people)];
  }

  return syncItemsWithPeople(items, people);
}
