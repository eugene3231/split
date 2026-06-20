import { formatCurrencyFromCents, parseCurrencyToCents } from '@shared/logic/core/money';
import type { EditableItem, Person } from '@shared/types';
import type { ItemsSubPhase } from '@features/split-workspace/types';
import { isItemAssigned } from '@features/split-workspace/logic/wizardValidation';

export type AssignmentSplitMode = 'equal' | 'shares';

export interface AssignmentPersonRow {
  id: string;
  name: string;
  colorIndex: number;
  isSelected: boolean;
  shareAmountCents: number;
  shareLabel: string;
  weight: number;
  canDecrementWeight: boolean;
}

export interface AssignmentActiveItem {
  id: string;
  title: string;
  priceCents: number | null;
  priceLabel: string;
  isAssigned: boolean;
  selectedPersonIds: string[];
  splitMode: AssignmentSplitMode;
  canUseShares: boolean;
}

export interface AssignmentAssignModel {
  activeItem: AssignmentActiveItem | null;
  activeItemPositionLabel: string;
  people: AssignmentPersonRow[];
  canSplitUnassigned: boolean;
  unassignedItemCount: number;
}

export interface AssignmentReviewRow {
  itemId: string;
  title: string;
  priceCents: number | null;
  priceLabel: string | null;
  isAssigned: boolean;
  splitLabel: string;
}

export interface AssignmentReviewModel {
  itemCount: number;
  rows: AssignmentReviewRow[];
}

export interface AssignmentInteraction {
  phase: ItemsSubPhase;
  assign: AssignmentAssignModel;
  review: AssignmentReviewModel;
}

export type AssignmentCommand =
  | { type: 'toggle-person'; personId: string; checked: boolean }
  | { type: 'select-all' }
  | { type: 'select-none' }
  | { type: 'assign-only'; personId: string }
  | { type: 'set-split-mode'; mode: AssignmentSplitMode }
  | { type: 'adjust-weight'; personId: string; delta: number }
  | { type: 'set-weight'; personId: string; value: number };

export type AssignmentCommandResult =
  | { type: 'item-updated'; itemId: string; item: EditableItem }
  | { type: 'ignored' };

export function resolveAssignmentInteraction(args: {
  items: EditableItem[];
  people: Person[];
  phase: ItemsSubPhase;
  activeItemIndex: number;
  currency: string;
}): AssignmentInteraction {
  const { items, people, phase, activeItemIndex, currency } = args;
  const validPeopleSet = new Set(people.map((person) => person.id));
  const activeItem = items[activeItemIndex] ?? null;
  const unassignedItemCount = items.filter((item) => !isItemAssigned(item, validPeopleSet)).length;

  return {
    phase,
    assign: {
      activeItem: activeItem
        ? resolveActiveItem(activeItem, people, validPeopleSet, currency)
        : null,
      activeItemPositionLabel: activeItem ? `Item ${activeItemIndex + 1} of ${items.length}` : '',
      people: activeItem ? resolvePersonRows(activeItem, people, currency) : [],
      canSplitUnassigned: people.length > 0 && unassignedItemCount > 0,
      unassignedItemCount,
    },
    review: {
      itemCount: items.length,
      rows: items.map((item) => resolveReviewRow(item, people, currency)),
    },
  };
}

export function applyAssignmentCommand(args: {
  command: AssignmentCommand;
  item: EditableItem | null;
  people: Person[];
}): AssignmentCommandResult {
  const { command, item, people } = args;
  if (!item) return { type: 'ignored' };

  if (command.type === 'toggle-person') {
    return updated(item, togglePersonInAssignment(command.personId, command.checked, item));
  }

  if (command.type === 'select-all') {
    return updated(item, selectAllPeople(people, item));
  }

  if (command.type === 'select-none') {
    return updated(item, selectNone(item));
  }

  if (command.type === 'assign-only') {
    return updated(item, assignOnlyPerson(command.personId, item));
  }

  if (command.type === 'set-split-mode') {
    return updated(item, setSplitMode(command.mode, item));
  }

  if (command.type === 'adjust-weight') {
    const current = item.assignment.weights?.[command.personId] ?? 1;
    return updated(item, setShareWeight(command.personId, current + command.delta, item));
  }

  return updated(item, setShareWeight(command.personId, command.value, item));
}

export function togglePersonInAssignment(
  personId: string,
  checked: boolean,
  currentItem: EditableItem,
): EditableItem {
  const currentIds = new Set(currentItem.assignment.personIds);
  if (checked) currentIds.add(personId);
  else currentIds.delete(personId);

  const nextIds = Array.from(currentIds);
  let nextWeights: Record<string, number> | undefined;
  if (currentItem.assignment.weights && nextIds.length >= 2) {
    nextWeights = Object.fromEntries(
      nextIds.map((id) => [id, currentItem.assignment.weights![id] ?? 1]),
    );
  }

  return {
    ...currentItem,
    assignment: { mode: 'equal', personId: '', personIds: nextIds, weights: nextWeights },
  };
}

export function selectAllPeople(people: Person[], currentItem: EditableItem): EditableItem {
  return {
    ...currentItem,
    assignment: {
      mode: 'equal',
      personId: '',
      personIds: people.map((person) => person.id),
      weights: undefined,
    },
  };
}

export function selectNone(currentItem: EditableItem): EditableItem {
  return {
    ...currentItem,
    assignment: { mode: 'equal', personId: '', personIds: [], weights: undefined },
  };
}

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

    return {
      ...item,
      assignment: {
        mode: 'equal',
        personId: '',
        personIds,
        weights: undefined,
      },
    };
  });
}

function resolveActiveItem(
  item: EditableItem,
  people: Person[],
  validPeopleSet: Set<string>,
  currency: string,
): AssignmentActiveItem {
  const priceCents = parseCurrencyToCents(item.amountInput);
  return {
    id: item.id,
    title: item.name || 'Untitled item',
    priceCents,
    priceLabel: priceCents !== null ? formatCurrencyFromCents(priceCents, currency) : '—',
    isAssigned: isItemAssigned(item, validPeopleSet),
    selectedPersonIds: item.assignment.personIds,
    splitMode: item.assignment.weights ? 'shares' : 'equal',
    canUseShares: item.assignment.personIds.length >= 2 && people.length >= 2,
  };
}

function resolvePersonRows(
  item: EditableItem,
  people: Person[],
  currency: string,
): AssignmentPersonRow[] {
  const selectedIds = item.assignment.personIds;
  const selectedSet = new Set(selectedIds);
  const weights = item.assignment.weights;
  const totalWeight = selectedIds.reduce((sum, id) => sum + (weights?.[id] ?? 1), 0);
  const priceCents = parseCurrencyToCents(item.amountInput);

  return people.map((person, index) => {
    const isSelected = selectedSet.has(person.id);
    const weight = weights?.[person.id] ?? 1;
    const shareAmountCents =
      isSelected && priceCents !== null && totalWeight > 0
        ? Math.round((priceCents * weight) / totalWeight)
        : 0;

    return {
      id: person.id,
      name: person.name,
      colorIndex: index,
      isSelected,
      shareAmountCents,
      shareLabel: formatCurrencyFromCents(shareAmountCents, currency),
      weight,
      canDecrementWeight: weight > 1,
    };
  });
}

function resolveReviewRow(
  item: EditableItem,
  people: Person[],
  currency: string,
): AssignmentReviewRow {
  const selectedPeople = people.filter((person) => item.assignment.personIds.includes(person.id));
  const isAssigned = selectedPeople.length > 0;
  const priceCents = parseCurrencyToCents(item.amountInput);

  return {
    itemId: item.id,
    title: item.name,
    priceCents,
    priceLabel: priceCents !== null ? formatCurrencyFromCents(priceCents, currency) : null,
    isAssigned,
    splitLabel: isAssigned ? resolveSplitLabel(item, selectedPeople) : 'No people selected',
  };
}

function resolveSplitLabel(item: EditableItem, selectedPeople: Person[]): string {
  const weights = item.assignment.weights;
  const hasUnequalWeights =
    weights !== undefined &&
    item.assignment.personIds.length >= 2 &&
    item.assignment.personIds.some((id) => (weights[id] ?? 1) !== 1);

  if (!hasUnequalWeights) {
    return `Split: ${selectedPeople.map((person) => person.name).join(', ')}`;
  }

  return `Split: ${selectedPeople
    .map((person) => {
      const weight = weights?.[person.id] ?? 1;
      return `${person.name} ×${weight}`;
    })
    .join(', ')}`;
}

function assignOnlyPerson(personId: string, item: EditableItem): EditableItem {
  return {
    ...item,
    assignment: { mode: 'equal', personId: '', personIds: [personId], weights: undefined },
  };
}

function setSplitMode(mode: AssignmentSplitMode, item: EditableItem): EditableItem {
  if (item.assignment.personIds.length < 2) {
    return item;
  }

  return {
    ...item,
    assignment: {
      ...item.assignment,
      weights:
        mode === 'shares'
          ? Object.fromEntries(item.assignment.personIds.map((id) => [id, 1]))
          : undefined,
    },
  };
}

function setShareWeight(personId: string, value: number, item: EditableItem): EditableItem {
  const selectedIds = item.assignment.personIds;
  if (!selectedIds.includes(personId)) {
    return item;
  }

  const clamped = Math.max(1, Math.round(value));
  const weights = item.assignment.weights;
  const updatedWeights: Record<string, number> = {};
  for (const id of selectedIds) {
    updatedWeights[id] = id === personId ? clamped : (weights?.[id] ?? 1);
  }

  return {
    ...item,
    assignment: { ...item.assignment, weights: updatedWeights },
  };
}

function updated(item: EditableItem, nextItem: EditableItem): AssignmentCommandResult {
  return { type: 'item-updated', itemId: item.id, item: nextItem };
}
