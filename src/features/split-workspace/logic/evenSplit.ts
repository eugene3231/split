import type { EditableItem, Person } from '@shared/types';
import { hasAnyValidReceiptItem } from '@features/split-workspace/logic/wizardValidation';

export function assignEveryItemEqually(items: EditableItem[], people: Person[]): EditableItem[] {
  if (people.length === 0) return items;
  const personIds = people.map((person) => person.id);
  return items.map((item) => ({
    ...item,
    assignment: { mode: 'equal', personId: '', personIds },
  }));
}

export function canSplitEvenly(items: EditableItem[], people: Person[]): boolean {
  if (people.length < 2 || !hasAnyValidReceiptItem(items)) return false;
  return !items.every((item) => {
    const { mode, personIds, weights, unassignedWeight } = item.assignment;
    if (mode !== 'equal' || unassignedWeight) return false;
    const selectedIds = new Set(personIds);
    if (
      selectedIds.size !== people.length ||
      !people.every((person) => selectedIds.has(person.id))
    ) {
      return false;
    }
    return new Set(people.map((person) => weights?.[person.id] ?? 1)).size === 1;
  });
}

export function hasReceiptSelections(items: EditableItem[]): boolean {
  return items.some((item) =>
    item.assignment.mode === 'single'
      ? Boolean(item.assignment.personId)
      : item.assignment.personIds.length > 0,
  );
}
