import type { EditableItem, ItemAssignment, Person } from '@shared/types';
import { createId } from '@shared/logic/core/id';

/** An item nobody is on yet. */
export const NOBODY: ItemAssignment = { shares: {}, unassignedShare: 0 };

/**
 * The only way to build an assignment, so each split has one stored form: shares that are not
 * positive are dropped, the weights are reduced by their common divisor (an equal split is
 * always 1 each), and an unassigned share with nobody beside it is forgotten.
 */
export function makeAssignment(
  shares: Record<string, number>,
  unassignedShare = 0,
): ItemAssignment {
  const entries = Object.entries(shares).filter(([, weight]) => weight > 0);
  if (entries.length === 0) return NOBODY;

  const unassigned = Math.max(0, unassignedShare);
  const divisor = entries.reduce((common, [, weight]) => gcd(common, weight), unassigned);
  return {
    shares: Object.fromEntries(entries.map(([id, weight]) => [id, weight / divisor])),
    unassignedShare: unassigned / divisor,
  };
}

/** Exactly these people on the item in equal shares, with nothing left over. */
export function equalShares(personIds: string[]): ItemAssignment {
  return makeAssignment(Object.fromEntries(personIds.map((id) => [id, 1])));
}

/** Everyone on the item has the same share and none of it is left over. */
export function hasEqualShares({ shares, unassignedShare }: ItemAssignment): boolean {
  return unassignedShare === 0 && new Set(Object.values(shares)).size <= 1;
}

export function totalShare({ shares, unassignedShare }: ItemAssignment): number {
  return Object.values(shares).reduce((sum, weight) => sum + weight, unassignedShare);
}

export function isItemAssigned(item: EditableItem, validPeople: Set<string>): boolean {
  const { shares, unassignedShare } = item.assignment;
  return unassignedShare === 0 && Object.keys(shares).some((id) => validPeople.has(id));
}

export function createDefaultItem(): EditableItem {
  return {
    id: createId(),
    name: '',
    amountInput: '',
    discountPercentInput: '',
    assignment: NOBODY,
  };
}

/** Takes anyone who is no longer in the split off every item. */
export function syncItemsWithPeople(items: EditableItem[], people: Person[]): EditableItem[] {
  const validIds = new Set(people.map((person) => person.id));

  return items.map((item) => {
    const entries = Object.entries(item.assignment.shares);
    const kept = entries.filter(([id]) => validIds.has(id));
    if (kept.length === entries.length) return item;
    return {
      ...item,
      assignment: makeAssignment(Object.fromEntries(kept), item.assignment.unassignedShare),
    };
  });
}

export function buildInitialItems(items: EditableItem[], people: Person[]): EditableItem[] {
  return items.length === 0 ? [createDefaultItem()] : syncItemsWithPeople(items, people);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
