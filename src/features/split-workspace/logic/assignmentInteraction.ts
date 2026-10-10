import type { EditableItem, Person } from '@shared/types';
import { isItemAssigned } from '@features/split-workspace/logic/wizardValidation';
import {
  setPersonShare,
  stepPersonShare,
  type ShareInput,
  type ShareStep,
} from '@features/split-workspace/logic/itemShare';
import {
  resolveTreaterId,
  treatItem,
  untreatItem,
} from '@features/split-workspace/logic/itemTreat';

export type AssignmentCommand =
  | { type: 'toggle-person'; personId: string; checked: boolean }
  | { type: 'step-share'; personId: string; step: ShareStep }
  | { type: 'set-share'; personId: string; input: ShareInput }
  | { type: 'treat'; personId: string }
  | { type: 'untreat' };

export function applyAssignmentCommand(
  item: EditableItem,
  command: AssignmentCommand,
): EditableItem {
  if (command.type === 'toggle-person') {
    return togglePersonInAssignment(command.personId, command.checked, item);
  }
  if (command.type === 'treat') {
    return treatItem(item, command.personId);
  }
  if (command.type === 'untreat') {
    return untreatItem(item);
  }
  // Changing your share means you're no longer covering the whole thing.
  if (command.type === 'step-share') {
    return stepPersonShare(untreatItem(item), command.personId, command.step);
  }
  return setPersonShare(untreatItem(item), command.personId, command.input);
}

export function togglePersonInAssignment(
  personId: string,
  checked: boolean,
  currentItem: EditableItem,
): EditableItem {
  const { personIds, weights, unassignedWeight } = currentItem.assignment;
  if (checked === personIds.includes(personId)) return currentItem;
  const treaterId = resolveTreaterId(currentItem);
  if (treaterId && treaterId !== personId) return currentItem;

  const nextIds = checked ? [...personIds, personId] : personIds.filter((id) => id !== personId);
  const nextWeights = { ...weights };
  let nextUnassigned = unassignedWeight;

  if (!checked) {
    // Once part of an item is unassigned, a leaver's slice joins it instead of going to the others.
    if (unassignedWeight) nextUnassigned = unassignedWeight + (weights?.[personId] ?? 1);
    delete nextWeights[personId];
  } else if (unassignedWeight) {
    // Ticking a half-claimed item takes the half nobody had.
    nextWeights[personId] = unassignedWeight;
    nextUnassigned = undefined;
  } else if (weights) {
    nextWeights[personId] = averageWeight(personIds.map((id) => weights[id] ?? 1));
  }

  const keepsWeights = nextIds.length >= 2 || (nextIds.length === 1 && nextUnassigned);
  return {
    ...currentItem,
    assignment: {
      mode: 'equal',
      personId: '',
      personIds: nextIds,
      weights: keepsWeights && (weights || nextUnassigned) ? nextWeights : undefined,
      unassignedWeight: nextIds.length > 0 ? nextUnassigned : undefined,
    },
  };
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

  const validPeopleSet = new Set(people.map((person) => person.id));
  const personIds = people.map((person) => person.id);

  return items.map((item) => {
    if (isItemAssigned(item, validPeopleSet)) {
      return item;
    }

    const leftover = item.assignment.unassignedWeight ?? 0;
    const claimants = new Set(item.assignment.personIds.filter((id) => validPeopleSet.has(id)));
    const weights =
      leftover > 0 && claimants.size > 0
        ? Object.fromEntries(
            personIds.map((id) => [
              id,
              claimants.has(id)
                ? (item.assignment.weights?.[id] ?? 1) * personIds.length + leftover
                : leftover,
            ]),
          )
        : undefined;

    return {
      ...item,
      assignment: { mode: 'equal', personId: '', personIds, weights },
    };
  });
}

function averageWeight(weights: number[]): number {
  return Math.max(1, Math.round(weights.reduce((sum, weight) => sum + weight, 0) / weights.length));
}
