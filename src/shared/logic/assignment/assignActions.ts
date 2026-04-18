import type { EditableItem, Person } from '@shared/types';

export function togglePersonInAssignment(
  personId: string,
  checked: boolean,
  currentItem: EditableItem,
): EditableItem {
  const currentIds = new Set(currentItem.assignment.personIds);
  if (checked) currentIds.add(personId);
  else currentIds.delete(personId);
  return {
    ...currentItem,
    assignment: { mode: 'equal' as const, personId: '', personIds: Array.from(currentIds) },
  };
}

export function selectAllPeople(people: Person[], currentItem: EditableItem): EditableItem {
  return {
    ...currentItem,
    assignment: { mode: 'equal' as const, personId: '', personIds: people.map((p) => p.id) },
  };
}

export function selectNone(currentItem: EditableItem): EditableItem {
  return {
    ...currentItem,
    assignment: { mode: 'equal' as const, personId: '', personIds: [] },
  };
}
