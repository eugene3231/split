import { parseCurrencyToCents } from '@shared/logic/core/money';
import { allocateCents } from '@features/split-workspace/logic/split/allocation';
import { redistributeOnChange } from '@features/split-workspace/logic/weightRedistribution';
import type { EditableItem } from '@shared/types';

/** The smallest slice the stepper reaches is 1/MAX_SHARE_DIVISOR; finer splits are typed. */
export const MAX_SHARE_DIVISOR = 10;

// Never a person id: ids come from createId().
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

interface ShareParts {
  personIds: string[];
  weights: Record<string, number>;
  unassignedWeight: number;
}

/**
 * Splits an item's price between its people and the unassigned share, so a
 * half-claimed item charges its one claimant only their half.
 */
export function allocateItemShares(
  priceCents: number,
  personIds: string[],
  weights: Record<string, number> | undefined,
  unassignedWeight: number | undefined,
): Record<string, number> {
  const keys = unassignedWeight ? [...personIds, UNASSIGNED_KEY] : personIds;
  const rawWeights: Record<string, number> = Object.fromEntries(
    personIds.map((id) => [id, weights?.[id] ?? 1]),
  );
  if (unassignedWeight) rawWeights[UNASSIGNED_KEY] = unassignedWeight;

  const allocation = allocateCents(priceCents, keys, rawWeights);
  delete allocation[UNASSIGNED_KEY];
  return allocation;
}

export function resolvePersonShare(
  item: EditableItem,
  personId: string,
  priceCents: number,
): PersonShare | null {
  const parts = readShareParts(item);
  if (!parts.personIds.includes(personId)) return null;

  const amountCents =
    allocateItemShares(priceCents, parts.personIds, parts.weights, parts.unassignedWeight)[
      personId
    ] ?? 0;

  return {
    label: formatShareFraction(parts.weights[personId], totalWeight(parts)),
    amountCents,
    canIncrease: stepTarget(parts, personId, 'increase') !== null,
    canDecrease: stepTarget(parts, personId, 'decrease') !== null,
  };
}

/** Apple-style − / +: walks this person's slice through Whole, 1/2, 1/3 … 1/MAX_SHARE_DIVISOR. */
export function stepPersonShare(
  item: EditableItem,
  personId: string,
  step: ShareStep,
): EditableItem {
  const parts = readShareParts(item);
  if (!parts.personIds.includes(personId)) return item;

  const divisor = stepTarget(parts, personId, step);
  return divisor === null ? item : setShareFraction(item, parts, personId, divisor);
}

export function setPersonShare(
  item: EditableItem,
  personId: string,
  input: ShareInput,
): EditableItem {
  const parts = readShareParts(item);
  if (!parts.personIds.includes(personId)) return item;

  if (input.kind === 'fraction') {
    const divisor = Math.round(input.divisor);
    return divisor >= 1 ? setShareFraction(item, parts, personId, divisor) : item;
  }

  const priceCents = parseCurrencyToCents(item.amountInput);
  if (priceCents === null || priceCents <= 0) return item;

  const cents =
    input.kind === 'amount' ? input.cents : Math.round((priceCents * input.value) / 100);
  return setShareAmount(item, parts, personId, cents, priceCents);
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

/** "Whole", "1/3", "2/5" while the denominator stays small, otherwise a rounded percent. */
export function formatShareFraction(part: number, total: number): string {
  const divisor = gcd(part, total);
  const numerator = part / divisor;
  const denominator = total / divisor;
  if (numerator === denominator) return 'Whole';
  if (denominator <= MAX_SHARE_DIVISOR) return `${numerator}/${denominator}`;
  return `${Math.round((part / total) * 100)}%`;
}

function readShareParts(item: EditableItem): ShareParts {
  const { personIds, weights, unassignedWeight } = item.assignment;
  return {
    personIds,
    weights: Object.fromEntries(personIds.map((id) => [id, weights?.[id] ?? 1])),
    unassignedWeight: unassignedWeight ?? 0,
  };
}

function totalWeight(parts: ShareParts): number {
  return parts.personIds.reduce((sum, id) => sum + parts.weights[id], parts.unassignedWeight);
}

/** n when this person holds exactly 1/n of the item, otherwise null. */
function currentDivisor(parts: ShareParts, personId: string): number | null {
  const divisor = totalWeight(parts) / parts.weights[personId];
  return Number.isInteger(divisor) ? divisor : null;
}

function stepTarget(parts: ShareParts, personId: string, step: ShareStep): number | null {
  const exact = totalWeight(parts) / parts.weights[personId];
  const current = currentDivisor(parts, personId);
  const target =
    step === 'decrease'
      ? (current ?? Math.floor(exact)) + 1
      : current !== null
        ? current - 1
        : Math.floor(exact);

  // Taking the whole item would push everyone else off it; untick them instead.
  const smallestDivisor = parts.personIds.length > 1 ? 2 : 1;
  return target >= smallestDivisor && target <= MAX_SHARE_DIVISOR ? target : null;
}

/** Gives this person 1/divisor; everyone else, and any unassigned share, keep their ratio of the rest. */
function setShareFraction(
  item: EditableItem,
  parts: ShareParts,
  personId: string,
  divisor: number,
): EditableItem {
  const others = parts.personIds.filter((id) => id !== personId);
  const rest = totalWeight(parts) - parts.weights[personId];

  if (divisor === 1) {
    return withShares(item, [personId], { [personId]: 1 }, 0);
  }
  if (rest === 0) {
    return withShares(item, parts.personIds, { [personId]: 1 }, divisor - 1);
  }

  const weights: Record<string, number> = { [personId]: rest };
  for (const id of others) weights[id] = parts.weights[id] * (divisor - 1);
  return withShares(item, parts.personIds, weights, parts.unassignedWeight * (divisor - 1));
}

/**
 * Sets this person's share in cents. The difference comes out of (or goes back
 * to) everyone else in proportion; with nobody else on the item it becomes the
 * unassigned share.
 */
function setShareAmount(
  item: EditableItem,
  parts: ShareParts,
  personId: string,
  cents: number,
  priceCents: number,
): EditableItem {
  const keys = [...parts.personIds, UNASSIGNED_KEY];
  const weights = { ...parts.weights, [UNASSIGNED_KEY]: parts.unassignedWeight };
  const previous = allocateCents(priceCents, keys, weights);
  const next = redistributeOnChange(previous, personId, cents, priceCents, keys);

  const survivors = parts.personIds.filter((id) => next[id] > 0);
  return withShares(
    item,
    survivors,
    Object.fromEntries(survivors.map((id) => [id, next[id]])),
    next[UNASSIGNED_KEY] ?? 0,
  );
}

function withShares(
  item: EditableItem,
  personIds: string[],
  weights: Record<string, number>,
  unassignedWeight: number,
): EditableItem {
  const divisor = [...personIds.map((id) => weights[id] ?? 1), unassignedWeight]
    .filter((weight) => weight > 0)
    .reduce(gcd, 0);
  const reduced = Object.fromEntries(
    personIds.map((id) => [id, (weights[id] ?? 1) / (divisor || 1)]),
  );
  const reducedUnassigned = unassignedWeight / (divisor || 1);
  const isEqual =
    reducedUnassigned === 0 && personIds.every((id) => reduced[id] === reduced[personIds[0]]);

  return {
    ...item,
    assignment: {
      mode: 'equal',
      personId: '',
      personIds,
      weights: personIds.length === 0 || isEqual ? undefined : reduced,
      unassignedWeight:
        personIds.length === 0 || reducedUnassigned === 0 ? undefined : reducedUnassigned,
    },
  };
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
