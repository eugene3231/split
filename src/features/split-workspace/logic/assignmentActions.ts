import type { EditableItem, Person } from '@shared/types';
import { isItemAssigned } from '@features/split-workspace/logic/wizardValidation';

export function togglePersonInAssignment(
  personId: string,
  checked: boolean,
  currentItem: EditableItem,
): EditableItem {
  const currentIds = new Set(currentItem.assignment.personIds);
  if (checked) currentIds.add(personId);
  else currentIds.delete(personId);

  const nextIds = Array.from(currentIds);
  let nextWeights: Record<string, number> | undefined;
  if (currentItem.assignment.weights && nextIds.length >= 2) {
    nextWeights = Object.fromEntries(
      nextIds.map((id) => [id, currentItem.assignment.weights![id] ?? 1]),
    );
  }

  return {
    ...currentItem,
    assignment: { mode: 'equal' as const, personId: '', personIds: nextIds, weights: nextWeights },
  };
}

export function selectAllPeople(people: Person[], currentItem: EditableItem): EditableItem {
  return {
    ...currentItem,
    assignment: {
      mode: 'equal' as const,
      personId: '',
      personIds: people.map((p) => p.id),
      weights: undefined,
    },
  };
}

export function selectNone(currentItem: EditableItem): EditableItem {
  return {
    ...currentItem,
    assignment: { mode: 'equal' as const, personId: '', personIds: [], weights: undefined },
  };
}

export function splitUnassignedItemsEqually(
  items: EditableItem[],
  people: Person[],
): EditableItem[] {
  if (people.length === 0) {
    return items;
  }

  const validPeopleSet = new Set(people.map((person) => person.id));
  const personIds = people.map((person) => person.id);

  return items.map((item) => {
    if (isItemAssigned(item, validPeopleSet)) {
      return item;
    }

    return {
      ...item,
      assignment: {
        mode: 'equal' as const,
        personId: '',
        personIds,
        weights: undefined,
      },
    };
  });
}
