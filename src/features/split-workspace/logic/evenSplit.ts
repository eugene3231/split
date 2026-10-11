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
  return items.every((item) =>
    item.assignment.mode === 'single'
      ? item.assignment.personId.length === 0
      : item.assignment.personIds.length === 0,
  );
}
