import type { EditableItem, Person } from '@shared/types';
import { createId } from '@shared/logic/core/id';
import { isEqual } from 'lodash-es';

export function createEmptyItem(people: Person[]): EditableItem {
  return {
    id: createId(),
    name: '',
    amountInput: '',
    discountPercentInput: '',
    assignment: {
      mode: 'single',
      personId: people[0]?.id ?? '',
      personIds: people.map((person) => person.id),
    },
  };
}

export function sanitizeItemAssignment(item: EditableItem, people: Person[]): EditableItem {
  const validIds = new Set(people.map((person) => person.id));

  if (item.assignment.mode === 'single') {
    const nextPersonId = validIds.has(item.assignment.personId)
      ? item.assignment.personId
      : (people[0]?.id ?? '');

    if (nextPersonId === item.assignment.personId) {
      return item;
    }

    return {
      ...item,
      assignment: {
        ...item.assignment,
        personId: nextPersonId,
      },
    };
  }

  const filteredIds = item.assignment.personIds.filter((personId) => validIds.has(personId));
  const nextIds = Array.from(new Set(filteredIds));

  if (isEqual(nextIds, item.assignment.personIds)) {
    return item;
  }

  return {
    ...item,
    assignment: {
      ...item.assignment,
      personIds: nextIds,
    },
  };
}

export function pickDefaultPersonId(people: Person[], candidate: string): string {
  const validIds = new Set(people.map((person) => person.id));
  return validIds.has(candidate) ? candidate : (people[0]?.id ?? '');
}

export function isItemAssigned(item: EditableItem, peopleSet: Set<string>): boolean {
  if (item.assignment.mode === 'single') {
    return peopleSet.has(item.assignment.personId);
  }

  return item.assignment.personIds.some((personId) => peopleSet.has(personId));
}
