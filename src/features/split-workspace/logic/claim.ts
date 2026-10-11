import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { resolveDiscountedAmountCents } from '@features/split-workspace/logic/split/pricing';
import { formatShareFraction, resolvePersonShare } from '@features/split-workspace/logic/itemShare';
import type { PersonShare } from '@features/split-workspace/logic/itemShare';
import type { EditableItem, Person, Receipt } from '@shared/types';
import {
  getAssignedItemsCount,
  getDetectedItemsCount,
  isItemAssigned,
} from '@features/split-workspace/logic/wizardValidation';

export interface ClaimPerson {
  id: string;
  name: string;
  colorIndex: number;
  firstName: string;
  totalCents: number;
  /** Items this person is on, across every receipt. */
  itemCount: number;
  isActive: boolean;
}

export interface ClaimItemShare extends PersonShare {
  amountLabel: string;
  /** False once everyone already has an equal share. */
  canSplitEvenly: boolean;
  /** False once the active person has the whole item alone. */
  canTakeAlone: boolean;
}

export interface ClaimItem {
  id: string;
  receiptId: string;
  name: string;
  priceLabel: string;
  claimedByActive: boolean;
  isLeft: boolean;
  /** Everyone on the item, in people order. */
  claimants: ClaimPerson[];
  /** "1/2 left" when part of the item has nobody yet. */
  leftLabel: string | null;
  /** The active person's slice; null when they are not on the item. */
  share: ClaimItemShare | null;
}

export interface ClaimSection {
  receiptId: string;
  name: string;
  currency: string;
  items: ClaimItem[];
  /** How many of the receipt's items the active person is on. */
  activeSelection: 'none' | 'some' | 'all';
  /** True when the active person has an uneven share on one of the receipt's items. */
  activeHasCustomShare: boolean;
}

export interface ClaimView {
  activePerson: ClaimPerson | null;
  people: ClaimPerson[];
  totalsCurrency: string;
  sections: ClaimSection[];
}

export type ClaimContinue =
  | { kind: 'next-person'; personId: string; label: string }
  | { kind: 'split-leftovers'; label: string }
  | { kind: 'see-summary'; label: string };

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

export function resolveActivePersonId(personId: string, people: Person[]): string {
  return people.some((person) => person.id === personId) ? personId : (people[0]?.id ?? '');
}

export function countItemsLeft(receipts: Receipt[], people: Person[]): number {
  const items = receipts.flatMap((receipt) => receipt.items);
  return getDetectedItemsCount(items) - getAssignedItemsCount(items, people);
}

export function resolveClaimView(args: {
  receipts: Receipt[];
  people: Person[];
  activePersonId: string;
  totalByPersonCents: Record<string, number>;
  totalsCurrency: string;
}): ClaimView {
  const { receipts, people, totalByPersonCents, totalsCurrency } = args;
  const activePersonId = resolveActivePersonId(args.activePersonId, people);
  const pricedItems = receipts
    .flatMap((receipt) => receipt.items)
    .filter((item) => resolveDiscountedAmountCents(item) !== null);

  const claimPeople = people.map((person, index): ClaimPerson => ({
    id: person.id,
    name: person.name,
    colorIndex: index,
    firstName: firstName(person.name),
    totalCents: totalByPersonCents[person.id] ?? 0,
    itemCount: pricedItems.filter((item) => item.assignment.personIds.includes(person.id)).length,
    isActive: person.id === activePersonId,
  }));

  const sections = receipts.map((receipt): ClaimSection => {
    const items = receipt.items.flatMap((item) => {
      const row = resolveClaimItem(item, receipt, claimPeople, activePersonId);
      return row ? [row] : [];
    });
    return {
      receiptId: receipt.id,
      name: receipt.name,
      currency: receipt.currency,
      items,
      activeSelection: resolveSelection(items),
      activeHasCustomShare: receipt.items.some((item) => hasCustomShare(item, activePersonId)),
    };
  });
  return {
    activePerson: claimPeople.find((person) => person.isActive) ?? null,
    people: claimPeople,
    totalsCurrency,
    sections,
  };
}

export function resolveClaimContinue(
  people: Person[],
  activePersonId: string,
  leftCount: number,
): ClaimContinue {
  const index = people.findIndex((person) => person.id === activePersonId);
  const nextPerson = people[index + 1];
  if (nextPerson) {
    return {
      kind: 'next-person',
      personId: nextPerson.id,
      label: `Next: ${firstName(nextPerson.name)}`,
    };
  }
  if (leftCount > 0) {
    return { kind: 'split-leftovers', label: `Split ${leftCount} left evenly` };
  }
  return { kind: 'see-summary', label: 'See summary' };
}

/** The person before the active one, or null on the first person. */
export function resolvePreviousPersonId(people: Person[], activePersonId: string): string | null {
  const index = people.findIndex((person) => person.id === activePersonId);
  return index > 0 ? people[index - 1].id : null;
}

function resolveClaimItem(
  item: EditableItem,
  receipt: Receipt,
  people: ClaimPerson[],
  activePersonId: string,
): ClaimItem | null {
  const priceCents = resolveDiscountedAmountCents(item);
  if (priceCents === null) return null;

  const validIds = new Set(people.map((person) => person.id));
  const claimedIds = new Set(item.assignment.personIds.filter((id) => validIds.has(id)));
  const claimants = people.filter((person) => claimedIds.has(person.id));
  const share = claimedIds.has(activePersonId)
    ? resolvePersonShare(item, activePersonId, priceCents)
    : null;

  const { weights, unassignedWeight } = item.assignment;
  const hasEqualWeights =
    !weights || new Set(item.assignment.personIds.map((id) => weights[id] ?? 1)).size <= 1;
  const isSplitEvenly = claimedIds.size === people.length && !unassignedWeight && hasEqualWeights;

  return {
    id: item.id,
    receiptId: receipt.id,
    name: item.name.trim() || 'Untitled item',
    priceLabel: formatCurrencyFromCents(priceCents, receipt.currency),
    claimedByActive: share !== null,
    isLeft: !isItemAssigned(item, validIds),
    claimants,
    leftLabel: describeLeftShare(item, claimants),
    share: share && {
      ...share,
      amountLabel: formatCurrencyFromCents(share.amountCents, receipt.currency),
      canSplitEvenly: people.length > 1 && !isSplitEvenly,
      canTakeAlone: claimedIds.size > 1 || Boolean(unassignedWeight),
    },
  };
}

function resolveSelection(items: ClaimItem[]): ClaimSection['activeSelection'] {
  const claimed = items.filter((item) => item.claimedByActive).length;
  if (claimed === 0) return 'none';
  return claimed === items.length ? 'all' : 'some';
}

/** A share other than an equal split of the whole item, which reselecting would not restore. */
function hasCustomShare(item: EditableItem, personId: string): boolean {
  const { personIds, weights, unassignedWeight } = item.assignment;
  if (!personIds.includes(personId) || resolveDiscountedAmountCents(item) === null) return false;
  if (unassignedWeight) return true;
  return Boolean(weights) && new Set(personIds.map((id) => weights?.[id] ?? 1)).size > 1;
}

function describeLeftShare(item: EditableItem, claimants: ClaimPerson[]): string | null {
  const unassignedWeight = item.assignment.unassignedWeight ?? 0;
  if (unassignedWeight === 0 || claimants.length === 0) return null;

  const total = claimants.reduce(
    (sum, person) => sum + (item.assignment.weights?.[person.id] ?? 1),
    unassignedWeight,
  );
  return `${formatShareFraction(unassignedWeight, total)} left`;
}
