import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { allocateCents } from '@shared/logic/split/allocation';
import { resolveDiscountedAmountCents } from '@shared/logic/split/pricing';
import type { EditableItem, Person, Receipt } from '@shared/types';
import {
  getAssignedItemsCount,
  getDetectedItemsCount,
} from '@features/split-workspace/logic/wizardValidation';

export interface ClaimPersonRef {
  id: string;
  name: string;
  colorIndex: number;
}

export interface ClaimPerson extends ClaimPersonRef {
  firstName: string;
  totalLabel: string;
  isActive: boolean;
}

export interface ClaimItem {
  id: string;
  name: string;
  priceLabel: string;
  claimedByActive: boolean;
  claimants: ClaimPersonRef[];
  shareLabel: string;
  canAdjustSplit: boolean;
}

export interface ClaimProgress {
  claimed: number;
  total: number;
  remaining: number;
}

export interface ClaimView {
  activePerson: ClaimPerson | null;
  people: ClaimPerson[];
  items: ClaimItem[];
  progress: ClaimProgress;
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

export function resolveClaimProgress(receipts: Receipt[], people: Person[]): ClaimProgress {
  const items = receipts.flatMap((receipt) => receipt.items);
  const total = getDetectedItemsCount(items);
  const claimed = getAssignedItemsCount(items, people);
  return { claimed, total, remaining: total - claimed };
}

export function resolveClaimView(args: {
  receipts: Receipt[];
  activeReceiptId: string;
  people: Person[];
  activePersonId: string;
  totalByPersonCents: Record<string, number>;
  totalsCurrency: string;
}): ClaimView {
  const { receipts, activeReceiptId, people, totalByPersonCents, totalsCurrency } = args;
  const activePersonId = resolveActivePersonId(args.activePersonId, people);
  const receipt = receipts.find((candidate) => candidate.id === activeReceiptId) ?? receipts[0];

  const claimPeople = people.map((person, index): ClaimPerson => ({
    id: person.id,
    name: person.name,
    colorIndex: index,
    firstName: firstName(person.name),
    totalLabel: formatCurrencyFromCents(totalByPersonCents[person.id] ?? 0, totalsCurrency),
    isActive: person.id === activePersonId,
  }));

  return {
    activePerson: claimPeople.find((person) => person.isActive) ?? null,
    people: claimPeople,
    items: (receipt?.items ?? []).flatMap((item) => {
      const row = resolveClaimItem(item, claimPeople, activePersonId, receipt.currency);
      return row ? [row] : [];
    }),
    progress: resolveClaimProgress(receipts, people),
  };
}

export function resolveClaimContinue(
  people: Person[],
  activePersonId: string,
  unclaimedCount: number,
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
  if (unclaimedCount > 0) {
    return { kind: 'split-leftovers', label: `Split ${unclaimedCount} left evenly` };
  }
  return { kind: 'see-summary', label: 'See summary' };
}

function resolveClaimItem(
  item: EditableItem,
  people: ClaimPerson[],
  activePersonId: string,
  currency: string,
): ClaimItem | null {
  const priceCents = resolveDiscountedAmountCents(item);
  if (priceCents === null) return null;

  const claimedIds = new Set(item.assignment.personIds);
  const claimants = people.filter((person) => claimedIds.has(person.id));
  const claimedByActive = claimedIds.has(activePersonId);

  return {
    id: item.id,
    name: item.name.trim() || 'Untitled item',
    priceLabel: formatCurrencyFromCents(priceCents, currency),
    claimedByActive,
    claimants: claimants.map(({ id, name, colorIndex }) => ({ id, name, colorIndex })),
    shareLabel: describeShare(item, claimants, activePersonId, priceCents, currency),
    canAdjustSplit: claimants.length >= 2,
  };
}

function describeShare(
  item: EditableItem,
  claimants: ClaimPerson[],
  activePersonId: string,
  priceCents: number,
  currency: string,
): string {
  if (claimants.length === 0) return 'Nobody yet';
  if (claimants.length === 1) {
    const [only] = claimants;
    return only.id === activePersonId ? 'Just you' : `Just ${only.firstName}`;
  }

  // Same order and weights as computeSplit so "you pay" matches the summary to the cent.
  const claimantIds = item.assignment.personIds.filter((id) =>
    claimants.some((person) => person.id === id),
  );
  const weights = Object.fromEntries(
    claimantIds.map((id) => [id, item.assignment.weights?.[id] ?? 1]),
  );
  const isEqual = new Set(Object.values(weights)).size === 1;

  if (isEqual) {
    const each = formatCurrencyFromCents(Math.round(priceCents / claimants.length), currency);
    return `Shared ${claimants.length} ways · ${each} each`;
  }

  if (!claimantIds.includes(activePersonId)) return 'Custom split';
  const shares = allocateCents(priceCents, claimantIds, weights);
  return `Custom split · you pay ${formatCurrencyFromCents(shares[activePersonId], currency)}`;
}
