import type { EditableItem, Person, Receipt } from '@shared/types';
import { hasAnyValidReceiptItem } from '@features/split-workspace/logic/wizardValidation';

export const EVEN_SPLIT_MIN_PEOPLE = 2;
export const EVEN_SPLIT_MAX_PEOPLE = 20;

/** Stand-in names for a group that only wants an even split; they can be removed or replaced later. */
export function placeholderNames(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `Person ${index + 1}`);
}

export function assignEveryItemEqually(items: EditableItem[], people: Person[]): EditableItem[] {
  if (people.length === 0) return items;
  const personIds = people.map((person) => person.id);
  return items.map((item) => ({
    ...item,
    assignment: { mode: 'equal', personId: '', personIds },
  }));
}

/**
 * The shortcut only replaces assignments nobody has made yet, so it is offered
 * once there is something to split and before anyone has claimed an item.
 */
export function canSplitEvenly(receipts: Receipt[], people: Person[]): boolean {
  if (people.length < EVEN_SPLIT_MIN_PEOPLE) return false;
  const items = receipts.flatMap((receipt) => receipt.items);
  if (!hasAnyValidReceiptItem(items)) return false;
  return items.every((item) => item.assignment.personIds.length === 0);
}
