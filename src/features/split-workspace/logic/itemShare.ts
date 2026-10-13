import { parseCurrencyToCents } from '@shared/logic/core/money';
import { allocate, allocateCents } from '@features/split-workspace/logic/split/allocation';
import { redistributeOnChange } from '@features/split-workspace/logic/weightRedistribution';
import {
  equalShares,
  makeAssignment,
  totalShare,
} from '@features/split-workspace/logic/assignment';
import type { EditableItem, ItemAssignment } from '@shared/types';

// Larger denominators read better as a percent, unless the share is a plain 1/n.
const MAX_LABEL_DENOMINATOR = 10;

// Stands in for the unassigned share where amounts are keyed by person. Never a person id: ids
// come from createId().
const UNASSIGNED_KEY = '\u0000unassigned';

export type ShareInput =
  | { kind: 'amount'; cents: number }
  | { kind: 'percent'; value: number }
  | { kind: 'fraction'; divisor: number };

export type ShareStep = 'increase' | 'decrease';

export interface PersonShare {
  label: string;
  amountCents: number;
  canIncrease: boolean;
  canDecrease: boolean;
}

/**
 * Splits an item's price between its people and the unassigned share, so a
 * half-claimed item charges its one claimant only their half.
 */
export function allocateItemShares(
  priceCents: number,
  { shares, unassignedShare }: ItemAssignment,
): Record<string, number> {
  const personIds = Object.keys(shares).sort((a, b) => a.localeCompare(b));
  // The unassigned share comes last, so a spare cent goes to a person before it.
  const cents = allocate(priceCents, [...personIds.map((id) => shares[id]), unassignedShare]);
  return Object.fromEntries(personIds.map((id, index) => [id, cents[index]]));
}

export function resolvePersonShare(
  item: EditableItem,
  personId: string,
  priceCents: number,
): PersonShare | null {
  const { assignment } = item;
  if (!Object.hasOwn(assignment.shares, personId)) return null;

  const smallerDivisor = stepTarget(assignment, personId, 'decrease');
  return {
    label: formatShareFraction(assignment.shares[personId], totalShare(assignment)),
    amountCents: allocateItemShares(priceCents, assignment)[personId],
    canIncrease: stepTarget(assignment, personId, 'increase') !== null,
    // Stop before a slice worth less than a cent.
    canDecrease: smallerDivisor !== null && smallerDivisor <= priceCents,
  };
}

/** − / +: walks this person's slice through 1, 1/2, 1/3 and on down. */
export function stepPersonShare(
  item: EditableItem,
  personId: string,
  step: ShareStep,
): EditableItem {
  if (!Object.hasOwn(item.assignment.shares, personId)) return item;

  const divisor = stepTarget(item.assignment, personId, step);
  return divisor === null ? item : setShareFraction(item, personId, divisor);
}

export function setPersonShare(
  item: EditableItem,
  personId: string,
  input: ShareInput,
): EditableItem {
  if (!Object.hasOwn(item.assignment.shares, personId)) return item;

  if (input.kind === 'fraction') {
    const divisor = Math.round(input.divisor);
    return divisor >= 1 ? setShareFraction(item, personId, divisor) : item;
  }

  const priceCents = parseCurrencyToCents(item.amountInput);
  if (priceCents === null || priceCents <= 0) return item;

  const cents =
    input.kind === 'amount' ? input.cents : Math.round((priceCents * input.value) / 100);
  return setShareAmount(item, personId, cents, priceCents);
}

/** Reads "8.50", "$8.50", "40%" or "1/3"; anything else is null. */
export function parseShareInput(raw: string): ShareInput | null {
  const text = raw.trim();
  if (text === '') return null;

  if (text.endsWith('%')) {
    const value = Number(text.slice(0, -1).trim());
    return Number.isFinite(value) && value >= 0 ? { kind: 'percent', value } : null;
  }

  const fraction = /^1\s*\/\s*(\d+)$/.exec(text);
  if (fraction) return { kind: 'fraction', divisor: Number(fraction[1]) };

  const cents = parseCurrencyToCents(text.replace(/^[^\d.-]+/, ''));
  return cents !== null && cents >= 0 ? { kind: 'amount', cents } : null;
}

/** "1", "1/3", "1/12", or "2/5" while the denominator stays small, otherwise a rounded percent. */
export function formatShareFraction(part: number, total: number): string {
  const divisor = gcd(part, total);
  const numerator = part / divisor;
  const denominator = total / divisor;
  if (numerator === denominator) return '1';
  if (numerator === 1 || denominator <= MAX_LABEL_DENOMINATOR) return `${numerator}/${denominator}`;
  return `${Math.round((part / total) * 100)}%`;
}

function stepTarget(assignment: ItemAssignment, personId: string, step: ShareStep): number | null {
  const exact = totalShare(assignment) / assignment.shares[personId];
  // n when this person holds exactly 1/n of the item, otherwise null.
  const current = Number.isInteger(exact) ? exact : null;
  const target =
    step === 'decrease'
      ? (current ?? Math.floor(exact)) + 1
      : current !== null
        ? current - 1
        : Math.floor(exact);

  return target >= 1 ? target : null;
}

/**
 * Gives this person 1/divisor; everyone else, and any unassigned share, keep their ratio of the rest.
 * Taking the whole item takes everyone else off it.
 */
function setShareFraction(item: EditableItem, personId: string, divisor: number): EditableItem {
  const { shares, unassignedShare } = item.assignment;
  const rest = totalShare(item.assignment) - shares[personId];

  if (divisor === 1) {
    return { ...item, assignment: equalShares([personId]) };
  }
  if (rest === 0) {
    return { ...item, assignment: makeAssignment({ [personId]: 1 }, divisor - 1) };
  }

  const scaled = Object.entries(shares).map(([id, weight]) => [
    id,
    id === personId ? rest : weight * (divisor - 1),
  ]);
  return {
    ...item,
    assignment: makeAssignment(Object.fromEntries(scaled), unassignedShare * (divisor - 1)),
  };
}

/**
 * Sets this person's share in cents. The difference comes out of (or goes back
 * to) everyone else in proportion; with nobody else on the item it becomes the
 * unassigned share.
 */
function setShareAmount(
  item: EditableItem,
  personId: string,
  cents: number,
  priceCents: number,
): EditableItem {
  const { shares, unassignedShare } = item.assignment;
  const keys = [...Object.keys(shares), UNASSIGNED_KEY];
  const previous = allocateCents(priceCents, keys, {
    ...shares,
    [UNASSIGNED_KEY]: unassignedShare,
  });
  const { [UNASSIGNED_KEY]: unassignedCents, ...centsByPerson } = redistributeOnChange(
    previous,
    personId,
    cents,
    priceCents,
    keys,
  );

  // The cents become the new weights; anyone typed down to nothing drops off the item.
  return { ...item, assignment: makeAssignment(centsByPerson, unassignedCents) };
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
