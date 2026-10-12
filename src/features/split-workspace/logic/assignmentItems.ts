import type { EditableItem, Person } from '@shared/types';
import { isEqual } from 'lodash-es';

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
