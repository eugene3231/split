import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { resolveDiscountedAmountCents } from '@features/split-workspace/logic/split/pricing';
import { formatShareFraction, resolvePersonShare } from '@features/split-workspace/logic/itemShare';
import type { PersonShare } from '@features/split-workspace/logic/itemShare';
import type { EditableItem, Person, Receipt } from '@shared/types';
import {
  hasEqualShares,
  isItemAssigned,
  totalShare,
} from '@features/split-workspace/logic/assignment';
import {
  getAssignedItemsCount,
  getDetectedItemsCount,
} from '@features/split-workspace/logic/wizardValidation';
import type { CurrencyCode } from '@shared/constants';

export interface ClaimPerson {
  id: string;
  name: string;
  colorIndex: number;
  firstName: string;
  totalCents: number;
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
  currency: CurrencyCode;
  items: ClaimItem[];
  /** How many of the receipt's items the active person is on. */
  activeSelection: 'none' | 'some' | 'all';
  /** True when the active person has an uneven share on one of the receipt's items. */
  activeHasCustomShare: boolean;
}

export interface ClaimView {
  activePerson: ClaimPerson | null;
  people: ClaimPerson[];
  totalsCurrency: CurrencyCode;
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
  totalsCurrency: CurrencyCode;
}): ClaimView {
  const { receipts, people, totalByPersonCents, totalsCurrency } = args;
  const activePersonId = resolveActivePersonId(args.activePersonId, people);
  const claimPeople = people.map((person, index): ClaimPerson => ({
    id: person.id,
    name: person.name,
    colorIndex: index,
    firstName: firstName(person.name),
    totalCents: totalByPersonCents[person.id] ?? 0,
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
  const { shares, unassignedShare } = item.assignment;
  const claimants = people.filter((person) => Object.hasOwn(shares, person.id));
  const share = resolvePersonShare(item, activePersonId, priceCents);
  const isSplitEvenly = claimants.length === people.length && hasEqualShares(item.assignment);

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
      canTakeAlone: claimants.length > 1 || unassignedShare > 0,
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
  if (!Object.hasOwn(item.assignment.shares, personId)) return false;
  return resolveDiscountedAmountCents(item) !== null && !hasEqualShares(item.assignment);
}

function describeLeftShare(item: EditableItem, claimants: ClaimPerson[]): string | null {
  const { unassignedShare } = item.assignment;
  if (unassignedShare === 0 || claimants.length === 0) return null;
  return `${formatShareFraction(unassignedShare, totalShare(item.assignment))} left`;
}
