import type { EditableItem, Person } from '@shared/types';
import { createId } from '@shared/logic/core/id';
import { sanitizeItemAssignment } from '@features/split-workspace/logic/assignmentItems';

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

export function normalizeItemAssignments(items: EditableItem[], people: Person[]): EditableItem[] {
  const personIds = people.map((person) => person.id);
  const validPeople = new Set(personIds);

  return items.map((item) => {
    const filteredIds = Array.from(
      new Set(item.assignment.personIds.filter((personId) => validPeople.has(personId))),
    );
    const nextPersonIds = item.assignment.mode === 'equal' ? filteredIds : personIds;

    const nextWeights = item.assignment.weights
      ? Object.fromEntries(
          nextPersonIds
            .filter((id) => id in item.assignment.weights!)
            .map((id) => [id, item.assignment.weights![id]]),
        )
      : undefined;

    const finalWeights =
      nextPersonIds.length < 2
        ? undefined
        : nextWeights && Object.keys(nextWeights).length > 0
          ? nextWeights
          : undefined;

    return {
      ...item,
      assignment: {
        mode: 'equal' as const,
        personId: '',
        personIds: nextPersonIds,
        weights: finalWeights,
        weightsInputMode: finalWeights ? item.assignment.weightsInputMode : undefined,
      },
    };
  });
}

export function syncItemsWithPeople(items: EditableItem[], people: Person[]): EditableItem[] {
  const sanitizedItems = items.map((item) => sanitizeItemAssignment(item, people));
  if (people.length === 0) {
    return sanitizedItems;
  }

  return normalizeItemAssignments(sanitizedItems, people);
}

export function buildInitialItems(items: EditableItem[], people: Person[]): EditableItem[] {
  if (items.length === 0) {
    return [createDefaultItem(people)];
  }

  return syncItemsWithPeople(items, people);
}
