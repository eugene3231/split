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
  totalLabel: string;
  isActive: boolean;
}

export interface ClaimItemShare extends PersonShare {
  amountLabel: string;
}

export interface ClaimItem {
  id: string;
  receiptId: string;
  name: string;
  priceLabel: string;
  claimedByActive: boolean;
  isLeft: boolean;
  claimantsLabel: string;
  /** The active person's slice; null when they are not on the item. */
  share: ClaimItemShare | null;
}

export interface ClaimSection {
  receiptId: string;
  name: string;
  currency: string;
  leftCount: number;
  items: ClaimItem[];
}

export interface ClaimView {
  activePerson: ClaimPerson | null;
  activeItemCount: number;
  people: ClaimPerson[];
  sections: ClaimSection[];
  leftCount: number;
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

export function formatItemCount(count: number): string {
  return `${count} ${count === 1 ? 'item' : 'items'}`;
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

  const claimPeople = people.map((person, index): ClaimPerson => ({
    id: person.id,
    name: person.name,
    colorIndex: index,
    firstName: firstName(person.name),
    totalLabel: formatCurrencyFromCents(totalByPersonCents[person.id] ?? 0, totalsCurrency),
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
      leftCount: items.filter((item) => item.isLeft).length,
      items,
    };
  });
  const items = sections.flatMap((section) => section.items);

  return {
    activePerson: claimPeople.find((person) => person.isActive) ?? null,
    activeItemCount: items.filter((item) => item.claimedByActive).length,
    people: claimPeople,
    sections,
    leftCount: items.filter((item) => item.isLeft).length,
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

  return {
    id: item.id,
    receiptId: receipt.id,
    name: item.name.trim() || 'Untitled item',
    priceLabel: formatCurrencyFromCents(priceCents, receipt.currency),
    claimedByActive: share !== null,
    isLeft: !isItemAssigned(item, validIds),
    claimantsLabel: describeClaimants(item, claimants),
    share: share && {
      ...share,
      amountLabel: formatCurrencyFromCents(share.amountCents, receipt.currency),
    },
  };
}

function describeClaimants(item: EditableItem, claimants: ClaimPerson[]): string {
  if (claimants.length === 0) return '';

  const names = claimants.map((person) => person.firstName);
  const label =
    names.length > 3 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
  const unassigned = describeUnassignedShare(item, claimants);
  return unassigned ? `${label} · ${unassigned} left` : label;
}

function describeUnassignedShare(item: EditableItem, claimants: ClaimPerson[]): string | null {
  const unassignedWeight = item.assignment.unassignedWeight ?? 0;
  if (unassignedWeight === 0) return null;

  const total = claimants.reduce(
    (sum, person) => sum + (item.assignment.weights?.[person.id] ?? 1),
    unassignedWeight,
  );
  return formatShareFraction(unassignedWeight, total);
}
