import type { EditableItem, Person } from '@shared/types';
import { equalShares, hasEqualShares } from '@features/split-workspace/logic/assignment';
import { hasAnyValidReceiptItem } from '@features/split-workspace/logic/wizardValidation';

export function assignEveryItemEqually(items: EditableItem[], people: Person[]): EditableItem[] {
  if (people.length === 0) return items;
  const assignment = equalShares(people.map((person) => person.id));
  return items.map((item) => ({ ...item, assignment }));
}

export function canSplitEvenly(items: EditableItem[], people: Person[]): boolean {
  if (people.length < 2 || !hasAnyValidReceiptItem(items)) return false;
  return !items.every(({ assignment }) => {
    const { shares } = assignment;
    return (
      hasEqualShares(assignment) &&
      Object.keys(shares).length === people.length &&
      people.every((person) => Object.hasOwn(shares, person.id))
    );
  });
}

export function hasReceiptSelections(items: EditableItem[]): boolean {
  return items.some((item) => Object.keys(item.assignment.shares).length > 0);
}
