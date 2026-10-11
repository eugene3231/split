import type { EditableItem, Person, Receipt } from '@shared/types';
import { hasAnyValidReceiptItem } from '@features/split-workspace/logic/wizardValidation';

export function assignEveryItemEqually(items: EditableItem[], people: Person[]): EditableItem[] {
  if (people.length === 0) return items;
  const personIds = people.map((person) => person.id);
  return items.map((item) => ({
    ...item,
    assignment: { mode: 'equal', personId: '', personIds },
  }));
}

/**
 * Starting from an even split only replaces assignments nobody has made yet,
 * so it is offered once there is something to split and before anyone claims an item.
 */
export function canSplitEvenly(receipts: Receipt[], people: Person[]): boolean {
  if (people.length < 2) return false;
  const items = receipts.flatMap((receipt) => receipt.items);
  if (!hasAnyValidReceiptItem(items)) return false;
  return items.every((item) => item.assignment.personIds.length === 0);
}
