import type { EditableItem, ItemAssignment, Person } from '@shared/types';
import {
  equalShares,
  isItemAssigned,
  makeAssignment,
} from '@features/split-workspace/logic/assignment';
import { resolveDiscountedAmountCents } from '@features/split-workspace/logic/split/pricing';
import {
  setPersonShare,
  stepPersonShare,
  type ShareInput,
  type ShareStep,
} from '@features/split-workspace/logic/itemShare';

export type AssignmentCommand =
  | { type: 'toggle-person'; personId: string; checked: boolean }
  | { type: 'step-share'; personId: string; step: ShareStep }
  | { type: 'set-share'; personId: string; input: ShareInput }
  | { type: 'split-evenly'; personIds: string[] }
  | { type: 'only-person'; personId: string };

export function applyAssignmentCommand(
  item: EditableItem,
  command: AssignmentCommand,
): EditableItem {
  if (command.type === 'toggle-person') {
    return togglePersonInAssignment(command.personId, command.checked, item);
  }
  if (command.type === 'step-share') {
    return stepPersonShare(item, command.personId, command.step);
  }
  if (command.type === 'split-evenly') {
    return { ...item, assignment: equalShares(command.personIds) };
  }
  if (command.type === 'only-person') {
    return { ...item, assignment: equalShares([command.personId]) };
  }
  return setPersonShare(item, command.personId, command.input);
}

export function togglePersonInAssignment(
  personId: string,
  checked: boolean,
  currentItem: EditableItem,
): EditableItem {
  const { shares, unassignedShare } = currentItem.assignment;
  if (checked === Object.hasOwn(shares, personId)) return currentItem;

  return {
    ...currentItem,
    assignment: checked
      ? addPerson(currentItem.assignment, personId)
      : removePerson(shares, unassignedShare, personId),
  };
}

function addPerson({ shares, unassignedShare }: ItemAssignment, personId: string): ItemAssignment {
  // Ticking a half-claimed item takes the half nobody had.
  if (unassignedShare > 0) return makeAssignment({ ...shares, [personId]: unassignedShare });

  // Otherwise a newcomer takes an average share, 1/(n+1) of the item, and everyone already on
  // it keeps their ratio of the rest.
  const weights = Object.values(shares);
  if (weights.length === 0) return equalShares([personId]);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const scaled = Object.entries(shares).map(([id, weight]) => [id, weight * weights.length]);
  return makeAssignment({ ...Object.fromEntries(scaled), [personId]: total });
}

function removePerson(
  shares: Record<string, number>,
  unassignedShare: number,
  personId: string,
): ItemAssignment {
  const { [personId]: leaving, ...rest } = shares;
  // Once part of an item is unassigned, a leaver's slice joins it instead of going to the others.
  return makeAssignment(rest, unassignedShare > 0 ? unassignedShare + leaving : 0);
}

/** Ticks or unticks one person on every priced item, the same as toggling each row. */
export function setPersonOnEveryItem(
  items: EditableItem[],
  personId: string,
  checked: boolean,
): EditableItem[] {
  return items.map((item) =>
    resolveDiscountedAmountCents(item) === null
      ? item
      : togglePersonInAssignment(personId, checked, item),
  );
}

/**
 * Gives every unassigned item, and every unassigned share, to everyone equally.
 * A claimant's weight scales by the head count so their existing slice is kept.
 */
export function splitUnassignedItemsEqually(
  items: EditableItem[],
  people: Person[],
): EditableItem[] {
  if (people.length === 0) {
    return items;
  }

  const personIds = people.map((person) => person.id);
  const validPeopleSet = new Set(personIds);

  return items.map((item) => {
    if (isItemAssigned(item, validPeopleSet)) {
      return item;
    }

    const { shares, unassignedShare } = item.assignment;
    const hasClaimant = personIds.some((id) => Object.hasOwn(shares, id));
    if (unassignedShare === 0 || !hasClaimant) {
      return { ...item, assignment: equalShares(personIds) };
    }

    return {
      ...item,
      assignment: makeAssignment(
        Object.fromEntries(
          personIds.map((id) => [id, (shares[id] ?? 0) * personIds.length + unassignedShare]),
        ),
      ),
    };
  });
}
