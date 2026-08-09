import { formatCurrencyFromCents, parseCurrencyToCents } from '@shared/logic/core/money';
import { allocateCents } from '@shared/logic/split/split';
import type { EditableItem, Person, Receipt, WeightsInputMode } from '@shared/types';
import type { ItemsSubPhase } from '@features/split-workspace/types';
import { isItemAssigned } from '@features/split-workspace/logic/wizardValidation';
import { redistributeOnChange } from '@features/split-workspace/logic/weightRedistribution';

export interface AssignmentPersonRow {
  id: string;
  name: string;
  colorIndex: number;
  isSelected: boolean;
  shareAmountCents: number;
  shareLabel: string;
  weight: number;
  percentValue: number;
}

export interface AssignmentActiveItem {
  id: string;
  title: string;
  priceCents: number | null;
  priceLabel: string;
  isAssigned: boolean;
  selectedPersonIds: string[];
  weightsInputMode: WeightsInputMode;
  canUseSplitControls: boolean;
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
  receiptId: string;
  receiptName: string;
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
  | { type: 'adjust-weight'; personId: string; delta: number }
  | { type: 'set-weight'; personId: string; value: number }
  | { type: 'set-weights-input-mode'; mode: WeightsInputMode }
  | { type: 'set-percent'; personId: string; value: number }
  | { type: 'set-amount'; personId: string; valueCents: number }
  | { type: 'reset-split-to-equal' };

export type AssignmentCommandResult =
  { type: 'item-updated'; itemId: string; item: EditableItem } | { type: 'ignored' };

export function resolveAssignmentInteraction(args: {
  items: EditableItem[];
  receipts: Receipt[];
  people: Person[];
  phase: ItemsSubPhase;
  activeItemIndex: number;
  currency: string;
}): AssignmentInteraction {
  const { items, receipts, people, phase, activeItemIndex, currency } = args;
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
      itemCount: receipts.reduce((sum, receipt) => sum + receipt.items.length, 0),
      rows: receipts.flatMap((receipt) =>
        receipt.items.map((item) => resolveReviewRow(item, people, receipt)),
      ),
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

  if (command.type === 'adjust-weight') {
    const current = item.assignment.weights?.[command.personId] ?? 1;
    return updated(item, setShareWeight(command.personId, current + command.delta, item));
  }

  if (command.type === 'set-weight') {
    return updated(item, setShareWeight(command.personId, command.value, item));
  }

  if (command.type === 'set-weights-input-mode') {
    return updated(item, setWeightsInputMode(command.mode, item));
  }

  if (command.type === 'set-percent') {
    return updated(item, commitPercent(item, command.personId, command.value));
  }

  if (command.type === 'set-amount') {
    return updated(item, commitAmount(item, command.personId, command.valueCents));
  }

  return updated(item, resetSplitToEqual(item));
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
    const weights = currentItem.assignment.weights;
    const mode = currentItem.assignment.weightsInputMode ?? 'shares';
    if (mode === 'shares') {
      nextWeights = Object.fromEntries(nextIds.map((id) => [id, weights[id] ?? 1]));
    } else {
      // Percent/amount weights are magnitudes, not multipliers — give the
      // newcomer an equal-sized slot by scaling to the existing average,
      // preserving everyone else's ratio.
      const existing = nextIds.filter((id) => weights[id] !== undefined);
      const avg = existing.reduce((sum, id) => sum + weights[id], 0) / Math.max(1, existing.length);
      nextWeights = Object.fromEntries(
        nextIds.map((id) => [id, weights[id] ?? Math.max(1, Math.round(avg))]),
      );
    }
  }

  return {
    ...currentItem,
    assignment: {
      mode: 'equal',
      personId: '',
      personIds: nextIds,
      weights: nextWeights,
      weightsInputMode: nextWeights ? currentItem.assignment.weightsInputMode : undefined,
    },
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

function rawWeightsOf(item: EditableItem, selectedIds: string[]): Record<string, number> {
  const weights = item.assignment.weights;
  return Object.fromEntries(selectedIds.map((id) => [id, weights?.[id] ?? 1]));
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
    weightsInputMode: item.assignment.weightsInputMode ?? 'shares',
    canUseSplitControls: item.assignment.personIds.length >= 2 && people.length >= 2,
  };
}

function resolvePersonRows(
  item: EditableItem,
  people: Person[],
  currency: string,
): AssignmentPersonRow[] {
  const selectedIds = item.assignment.personIds;
  const selectedSet = new Set(selectedIds);
  const rawWeights = rawWeightsOf(item, selectedIds);
  const priceCents = parseCurrencyToCents(item.amountInput);

  const normalizedCents =
    priceCents !== null ? allocateCents(priceCents, selectedIds, rawWeights) : {};
  const normalizedPercent = allocateCents(100, selectedIds, rawWeights);

  return people.map((person, index) => {
    const isSelected = selectedSet.has(person.id);
    const weight = item.assignment.weights?.[person.id] ?? 1;
    const shareAmountCents = isSelected ? (normalizedCents[person.id] ?? 0) : 0;
    const percentValue = isSelected ? (normalizedPercent[person.id] ?? 0) : 0;

    return {
      id: person.id,
      name: person.name,
      colorIndex: index,
      isSelected,
      shareAmountCents,
      shareLabel: formatCurrencyFromCents(shareAmountCents, currency),
      weight,
      percentValue,
    };
  });
}

function resolveReviewRow(
  item: EditableItem,
  people: Person[],
  receipt: Receipt,
): AssignmentReviewRow {
  const selectedPeople = people.filter((person) => item.assignment.personIds.includes(person.id));
  const isAssigned = selectedPeople.length > 0;
  const priceCents = parseCurrencyToCents(item.amountInput);

  return {
    itemId: item.id,
    receiptId: receipt.id,
    receiptName: receipt.name,
    title: item.name,
    priceCents,
    priceLabel: priceCents !== null ? formatCurrencyFromCents(priceCents, receipt.currency) : null,
    isAssigned,
    splitLabel: isAssigned
      ? resolveSplitLabel(item, selectedPeople, receipt.currency)
      : 'No people selected',
  };
}

function resolveSplitLabel(item: EditableItem, selectedPeople: Person[], currency: string): string {
  const weights = item.assignment.weights;
  const hasUnequalWeights =
    weights !== undefined &&
    item.assignment.personIds.length >= 2 &&
    item.assignment.personIds.some((id) => (weights[id] ?? 1) !== 1);

  if (!hasUnequalWeights) {
    return `Split: ${selectedPeople.map((person) => person.name).join(', ')}`;
  }

  const mode = item.assignment.weightsInputMode ?? 'shares';
  const selectedIds = item.assignment.personIds;
  const rawWeights = rawWeightsOf(item, selectedIds);
  const priceCents = parseCurrencyToCents(item.amountInput);
  const normalizedCents =
    priceCents !== null ? allocateCents(priceCents, selectedIds, rawWeights) : {};
  const normalizedPercent = allocateCents(100, selectedIds, rawWeights);

  return `Split: ${selectedPeople
    .map((person) => {
      if (mode === 'percent') {
        return `${person.name} ${normalizedPercent[person.id] ?? 0}%`;
      }
      if (mode === 'amount') {
        return `${person.name} ${formatCurrencyFromCents(normalizedCents[person.id] ?? 0, currency)}`;
      }
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
    assignment: { ...item.assignment, weights: updatedWeights, weightsInputMode: 'shares' },
  };
}

function setWeightsInputMode(mode: WeightsInputMode, item: EditableItem): EditableItem {
  return {
    ...item,
    assignment: { ...item.assignment, weightsInputMode: mode },
  };
}

function resetSplitToEqual(item: EditableItem): EditableItem {
  return {
    ...item,
    // `weightsInputMode` is deliberately left untouched — "Split equally" on
    // the Percent tab should stay on Percent, not silently jump to Shares.
    assignment: { ...item.assignment, weights: undefined },
  };
}

/**
 * A percent/amount commit can legitimately drive another selected person's
 * weight to exactly 0 (e.g. typing 100% for one of two people). Treat that as
 * an implicit deselect rather than leaving a $0.00 "involved" row, then
 * re-normalize the survivors so the total still reconciles exactly.
 */
function dropZeroWeightPeople(
  selectedIds: string[],
  weights: Record<string, number>,
  total: number,
): { personIds: string[]; weights: Record<string, number> | undefined } {
  const survivors = selectedIds.filter((id) => (weights[id] ?? 0) > 0);
  if (survivors.length === selectedIds.length) {
    return { personIds: selectedIds, weights };
  }
  if (survivors.length < 2) {
    return { personIds: survivors, weights: undefined };
  }
  const survivorWeights = Object.fromEntries(survivors.map((id) => [id, weights[id]]));
  return { personIds: survivors, weights: allocateCents(total, survivors, survivorWeights) };
}

function commitPercent(item: EditableItem, personId: string, value: number): EditableItem {
  const selectedIds = item.assignment.personIds;
  if (!selectedIds.includes(personId) || selectedIds.length < 2) {
    return item;
  }

  const rawWeights = rawWeightsOf(item, selectedIds);
  const prevPercents = allocateCents(100, selectedIds, rawWeights);
  const nextPercents = redistributeOnChange(
    prevPercents,
    personId,
    Math.round(value),
    100,
    selectedIds,
  );
  const { personIds, weights } = dropZeroWeightPeople(selectedIds, nextPercents, 100);

  return {
    ...item,
    assignment: { ...item.assignment, personIds, weights, weightsInputMode: 'percent' },
  };
}

function commitAmount(item: EditableItem, personId: string, valueCents: number): EditableItem {
  const selectedIds = item.assignment.personIds;
  const priceCents = parseCurrencyToCents(item.amountInput);
  if (
    !selectedIds.includes(personId) ||
    selectedIds.length < 2 ||
    priceCents === null ||
    priceCents <= 0
  ) {
    return item;
  }

  const rawWeights = rawWeightsOf(item, selectedIds);
  const prevAmounts = allocateCents(priceCents, selectedIds, rawWeights);
  const nextAmounts = redistributeOnChange(
    prevAmounts,
    personId,
    Math.round(valueCents),
    priceCents,
    selectedIds,
  );
  const { personIds, weights } = dropZeroWeightPeople(selectedIds, nextAmounts, priceCents);

  return {
    ...item,
    assignment: { ...item.assignment, personIds, weights, weightsInputMode: 'amount' },
  };
}

function updated(item: EditableItem, nextItem: EditableItem): AssignmentCommandResult {
  return { type: 'item-updated', itemId: item.id, item: nextItem };
}
