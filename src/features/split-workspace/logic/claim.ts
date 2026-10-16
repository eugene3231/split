import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { resolveDiscountedAmountCents } from '@features/split-workspace/logic/split/pricing';
import {
  allocateItemShares,
  formatShareFraction,
  resolvePersonShare,
} from '@features/split-workspace/logic/itemShare';
import type { PersonShare } from '@features/split-workspace/logic/itemShare';
import type { EditableItem, Person, Receipt } from '@shared/types';
import {
  hasEqualShares,
  isItemAssigned,
  totalShare,
} from '@features/split-workspace/logic/assignment';
import { getDetectedItemsCount } from '@features/split-workspace/logic/wizardValidation';
import type { CurrencyCode } from '@shared/constants';
import type { AssignMode } from '@features/split-workspace/types';

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

interface ClaimItemBase {
  id: string;
  receiptId: string;
  name: string;
  priceLabel: string;
  isLeft: boolean;
  /** Everyone on the item, in people order. */
  claimants: ClaimPerson[];
  /** "1/2 left" when part of the item has nobody yet. */
  leftLabel: string | null;
}

export interface ClaimItem extends ClaimItemBase {
  claimedByActive: boolean;
  /** Fully assigned to other people, so the active person can skip past it. */
  takenByOthers: boolean;
  /** The active person's slice; null when they are not on the item. */
  share: ClaimItemShare | null;
}

export type ClaimChip =
  | { person: ClaimPerson; selected: true; amountLabel: string }
  | { person: ClaimPerson; selected: false };

export interface ItemClaim extends ClaimItemBase {
  chips: ClaimChip[];
  isSplitEvenly: boolean;
  hasUnevenShares: boolean;
}

interface PricedClaimItem {
  base: ClaimItemBase;
  priceCents: number;
  isSplitEvenly: boolean;
}

interface ReceiptClaims<Item> {
  receiptId: string;
  name: string;
  currency: CurrencyCode;
  items: Item[];
  /** Items on the receipt that nobody has yet, or that still have an unassigned share. */
  leftCount: number;
}

export type ItemClaimSection = ReceiptClaims<ItemClaim>;

export interface ClaimSection extends ReceiptClaims<ClaimItem> {
  /** How many of the receipt's items the active person is on. */
  activeSelection: 'none' | 'some' | 'all';
  /** True when the active person has an uneven share on one of the receipt's items. */
  activeHasCustomShare: boolean;
}

export interface ClaimView {
  mode: 'person';
  activePerson: ClaimPerson | null;
  people: ClaimPerson[];
  totalsCurrency: CurrencyCode;
  sections: ClaimSection[];
}

export interface ItemClaimView {
  mode: 'item';
  people: ClaimPerson[];
  totalsCurrency: CurrencyCode;
  sections: ItemClaimSection[];
}

interface ClaimViewArgs {
  receipts: Receipt[];
  people: Person[];
  totalByPersonCents: Record<string, number>;
  totalsCurrency: CurrencyCode;
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

export interface ItemLeft {
  id: string;
  receiptName: string;
  name: string;
  priceLabel: string;
  /** "1/2 left" when someone already has part of it; null when nobody is on it. */
  leftLabel: string | null;
}

/** Every priced item that the last person's "Split n left evenly" would share out. */
export function listItemsLeft(receipts: Receipt[], people: Person[]): ItemLeft[] {
  const validIds = new Set(people.map((person) => person.id));
  return receipts.flatMap((receipt) =>
    receipt.items.flatMap((item) => {
      const priceCents = resolveDiscountedAmountCents(item);
      if (priceCents === null || isItemAssigned(item, validIds)) return [];
      const claimants = people.filter((person) => Object.hasOwn(item.assignment.shares, person.id));
      return [
        {
          id: item.id,
          receiptName: receipt.name,
          name: item.name.trim() || 'Untitled item',
          priceLabel: formatCurrencyFromCents(priceCents, receipt.currency),
          leftLabel: describeLeftShare(item, claimants),
        },
      ];
    }),
  );
}

export function countItems(receipts: Receipt[]): number {
  return getDetectedItemsCount(receipts.flatMap((receipt) => receipt.items));
}

export function countItemsLeft(receipts: Receipt[], people: Person[]): number {
  return listItemsLeft(receipts, people).length;
}

export function resolveClaimView(args: ClaimViewArgs & { activePersonId: string }): ClaimView {
  const { receipts, people, totalByPersonCents, totalsCurrency } = args;
  const activePersonId = resolveActivePersonId(args.activePersonId, people);
  const claimPeople = resolveClaimPeople(people, totalByPersonCents, activePersonId);

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
      leftCount: items.filter((item) => item.isLeft).length,
      activeSelection: resolveSelection(items),
      activeHasCustomShare: receipt.items.some((item) => hasCustomShare(item, activePersonId)),
    };
  });
  return {
    mode: 'person',
    activePerson: claimPeople.find((person) => person.isActive) ?? null,
    people: claimPeople,
    totalsCurrency,
    sections,
  };
}

export function resolveItemClaimView({
  receipts,
  people,
  totalByPersonCents,
  totalsCurrency,
}: ClaimViewArgs): ItemClaimView {
  const claimPeople = resolveClaimPeople(people, totalByPersonCents, null);
  return {
    mode: 'item',
    people: claimPeople,
    totalsCurrency,
    sections: receipts.map((receipt): ItemClaimSection => {
      const items = receipt.items.flatMap((item) => {
        const row = resolveItemClaim(item, receipt, claimPeople);
        return row ? [row] : [];
      });
      return {
        receiptId: receipt.id,
        name: receipt.name,
        currency: receipt.currency,
        items,
        leftCount: items.filter((item) => item.isLeft).length,
      };
    }),
  };
}

export function resolveNextOpenItemId(
  sections: ReceiptClaims<Pick<ClaimItemBase, 'id' | 'isLeft'>>[],
  fromItemId: string | null,
): string | null {
  const items = sections.flatMap((section) => section.items);
  if (fromItemId === null) return (items.find((item) => item.isLeft) ?? items[0])?.id ?? null;

  const from = items.findIndex((item) => item.id === fromItemId);
  const wrappedAfterFrom = [...items.slice(from + 1), ...items.slice(0, from)];
  return wrappedAfterFrom.find((item) => item.isLeft)?.id ?? null;
}

export function resolveClaimContinue(
  mode: AssignMode,
  people: Person[],
  activePersonId: string,
  leftCount: number,
): ClaimContinue {
  if (mode === 'person') {
    const index = people.findIndex((person) => person.id === activePersonId);
    const nextPerson = people[index + 1];
    if (nextPerson) {
      return {
        kind: 'next-person',
        personId: nextPerson.id,
        label: `Next: ${firstName(nextPerson.name)}`,
      };
    }
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

function resolveClaimPeople(
  people: Person[],
  totalByPersonCents: Record<string, number>,
  activePersonId: string | null,
): ClaimPerson[] {
  return people.map((person, index) => ({
    id: person.id,
    name: person.name,
    colorIndex: index,
    firstName: firstName(person.name),
    totalCents: totalByPersonCents[person.id] ?? 0,
    isActive: person.id === activePersonId,
  }));
}

function resolvePricedClaimItem(
  item: EditableItem,
  receipt: Receipt,
  people: ClaimPerson[],
): PricedClaimItem | null {
  const priceCents = resolveDiscountedAmountCents(item);
  if (priceCents === null) return null;

  const validIds = new Set(people.map((person) => person.id));
  const claimants = people.filter((person) => Object.hasOwn(item.assignment.shares, person.id));

  return {
    base: {
      id: item.id,
      receiptId: receipt.id,
      name: item.name.trim() || 'Untitled item',
      priceLabel: formatCurrencyFromCents(priceCents, receipt.currency),
      isLeft: !isItemAssigned(item, validIds),
      claimants,
      leftLabel: describeLeftShare(item, claimants),
    },
    priceCents,
    isSplitEvenly: claimants.length === people.length && hasEqualShares(item.assignment),
  };
}

function resolveClaimItem(
  item: EditableItem,
  receipt: Receipt,
  people: ClaimPerson[],
  activePersonId: string,
): ClaimItem | null {
  const resolved = resolvePricedClaimItem(item, receipt, people);
  if (!resolved) return null;

  const { base, priceCents, isSplitEvenly } = resolved;
  const share = resolvePersonShare(item, activePersonId, priceCents);
  return {
    ...base,
    claimedByActive: share !== null,
    takenByOthers: share === null && !base.isLeft,
    share: share && {
      ...share,
      amountLabel: formatCurrencyFromCents(share.amountCents, receipt.currency),
      canSplitEvenly: people.length > 1 && !isSplitEvenly,
      canTakeAlone: base.claimants.length > 1 || item.assignment.unassignedShare > 0,
    },
  };
}

function resolveItemClaim(
  item: EditableItem,
  receipt: Receipt,
  people: ClaimPerson[],
): ItemClaim | null {
  const resolved = resolvePricedClaimItem(item, receipt, people);
  if (!resolved) return null;

  const { base, priceCents, isSplitEvenly } = resolved;
  const { shares } = item.assignment;
  const amounts = allocateItemShares(priceCents, item.assignment);
  const weights = base.claimants.map((person) => shares[person.id]);

  return {
    ...base,
    chips: people.map((person): ClaimChip => {
      if (!Object.hasOwn(shares, person.id)) return { person, selected: false };
      const amountLabel = formatCurrencyFromCents(amounts[person.id], receipt.currency);
      return { person, selected: true, amountLabel };
    }),
    isSplitEvenly,
    hasUnevenShares: new Set(weights).size > 1,
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

function describeLeftShare(item: EditableItem, claimants: Person[]): string | null {
  const { unassignedShare } = item.assignment;
  if (unassignedShare === 0 || claimants.length === 0) return null;
  return `${formatShareFraction(unassignedShare, totalShare(item.assignment))} left`;
}
