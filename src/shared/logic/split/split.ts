import type {
  ChargeState,
  EditableItem,
  Person,
  PersonReceiptLineItem,
  ResolvedItem,
  SplitResult,
} from '@shared/types';
import { parseCurrencyToCents } from '@shared/logic/core/money';
import { resolveChargeCents } from '@shared/logic/split/charges';
import { parseDiscountPercent, resolveDiscountedAmountCents } from '@shared/logic/split/pricing';
import { convertSplitResult } from '@shared/logic/core/exchangeRates';
import { BASE_CURRENCY } from '@shared/constants';

export function computeSplit({
  people,
  items,
  discount,
  serviceCharge,
  gst,
}: {
  people: Person[];
  items: EditableItem[];
  discount: ChargeState;
  serviceCharge: ChargeState;
  gst: ChargeState;
}): SplitResult {
  const personIds = people.map((person) => person.id);
  const validPeopleSet = new Set(personIds);

  const subtotalByPersonCents = initializeCentsMap(personIds);
  let unassignedItemCount = 0;

  // --- Phase 1: Resolve valid items (O(N × A)) ---
  // Each resolved item captures who is assigned and their per-person amounts,
  // without yet writing into per-person structures.
  const resolvedItems: ResolvedItem[] = [];

  for (const item of items) {
    const netAmountCents = resolveDiscountedAmountCents(item);
    if (netAmountCents === null || netAmountCents === 0) continue;

    const grossAmountCents = parseCurrencyToCents(item.amountInput) ?? netAmountCents;
    const discountPercent = parseDiscountPercent(item.discountPercentInput);
    const discountAmountCents = Math.max(0, grossAmountCents - netAmountCents);
    const name = item.name.trim() || 'Untitled item';

    let assignedPersonIds: Set<string>;
    let netByPerson: Record<string, number>;
    let grossByPerson: Record<string, number>;

    if (item.assignment.mode === 'single') {
      if (!validPeopleSet.has(item.assignment.personId)) {
        unassignedItemCount += 1;
        continue;
      }
      assignedPersonIds = new Set([item.assignment.personId]);
      netByPerson = { [item.assignment.personId]: netAmountCents };
      grossByPerson = { [item.assignment.personId]: grossAmountCents };
    } else {
      const selectedIds = Array.from(
        new Set(item.assignment.personIds.filter((id) => validPeopleSet.has(id))),
      );
      if (selectedIds.length === 0) {
        unassignedItemCount += 1;
        continue;
      }
      const equalWeights = Object.fromEntries(selectedIds.map((id) => [id, 1]));
      const rawWeights = item.assignment.weights
        ? Object.fromEntries(selectedIds.map((id) => [id, item.assignment.weights![id] ?? 1]))
        : equalWeights;
      netByPerson = allocateCents(netAmountCents, selectedIds, rawWeights);
      grossByPerson = allocateCents(grossAmountCents, selectedIds, rawWeights);
      assignedPersonIds = new Set(selectedIds);
    }

    resolvedItems.push({
      itemId: item.id,
      name,
      grossAmountCents,
      discountPercent,
      discountAmountCents,
      assignedPersonIds,
      netByPerson,
      grossByPerson,
    });
  }

  // --- Phase 2: Populate lineItemsByPerson (O(N × P)) ---
  // Single pass preserves original item order. involvedCountByPerson is computed
  // alongside so components can O(1) check whether a person has any assigned items
  // and the canvas renderer can measure card heights without re-scanning.
  const lineItemsByPerson = initializeLineItemMap(personIds);
  const involvedCountByPerson = initializeCentsMap(personIds);

  for (const personId of personIds) {
    for (const resolved of resolvedItems) {
      if (resolved.assignedPersonIds.has(personId)) {
        const net = resolved.netByPerson[personId];
        const gross = resolved.grossByPerson[personId];
        subtotalByPersonCents[personId] += net;
        involvedCountByPerson[personId] += 1;
        lineItemsByPerson[personId].push({
          itemId: resolved.itemId,
          name: resolved.name,
          grossAmountCents: gross,
          discountPercent: resolved.discountPercent,
          discountAmountCents: Math.max(0, gross - net),
          netAmountCents: net,
          assignedAmountCents: net,
          splitCount: resolved.assignedPersonIds.size,
          involved: true,
        });
      } else {
        lineItemsByPerson[personId].push({
          itemId: resolved.itemId,
          name: resolved.name,
          grossAmountCents: resolved.grossAmountCents,
          discountPercent: resolved.discountPercent,
          discountAmountCents: resolved.discountAmountCents,
          netAmountCents: 0,
          assignedAmountCents: 0,
          splitCount: resolved.assignedPersonIds.size,
          involved: false,
        });
      }
    }
  }

  const subtotalCents = sumMapValues(subtotalByPersonCents);
  const discountCents = resolveChargeCents(discount, subtotalCents, subtotalCents);
  const discountWeights = weightsFromBase(subtotalByPersonCents, personIds);
  const discountByPersonCents = allocateCents(discountCents, personIds, discountWeights);

  const discountedSubtotalByPersonCents = initializeCentsMap(personIds);
  for (const personId of personIds) {
    discountedSubtotalByPersonCents[personId] = Math.max(
      0,
      subtotalByPersonCents[personId] - discountByPersonCents[personId],
    );
  }
  const discountedSubtotalCents = sumMapValues(discountedSubtotalByPersonCents);

  const serviceChargeCents = resolveChargeCents(
    serviceCharge,
    discountedSubtotalCents,
    discountedSubtotalCents,
  );
  const serviceWeights = weightsFromBase(discountedSubtotalByPersonCents, personIds);
  const serviceByPersonCents = allocateCents(serviceChargeCents, personIds, serviceWeights);

  const gstBaseCents = discountedSubtotalCents + serviceChargeCents;
  const gstCents = resolveChargeCents(gst, discountedSubtotalCents, gstBaseCents);

  const gstWeightSeed = initializeCentsMap(personIds);
  for (const personId of personIds) {
    gstWeightSeed[personId] = Math.max(
      0,
      discountedSubtotalByPersonCents[personId] + serviceByPersonCents[personId],
    );
  }

  const gstWeights = weightsFromBase(gstWeightSeed, personIds);
  const gstByPersonCents = allocateCents(gstCents, personIds, gstWeights);

  const totalByPersonCents = initializeCentsMap(personIds);
  for (const personId of personIds) {
    totalByPersonCents[personId] =
      discountedSubtotalByPersonCents[personId] +
      serviceByPersonCents[personId] +
      gstByPersonCents[personId];
  }

  const grandTotalCents = sumMapValues(totalByPersonCents);

  return {
    lineItemsByPerson,
    involvedCountByPerson,
    subtotalByPersonCents,
    discountByPersonCents,
    serviceByPersonCents,
    gstByPersonCents,
    totalByPersonCents,
    subtotalCents,
    discountCents,
    serviceChargeCents,
    gstCents,
    grandTotalCents,
    unassignedItemCount,
  };
}

export function computeConsolidatedSplit(
  results: SplitResult[],
  people: Person[],
  currencies: string[] = [],
  exchangeRates: Record<string, number> = {},
  exchangeRateOverrides: (number | null)[] = [],
  baseCurrency: string = BASE_CURRENCY,
): SplitResult {
  const personIds = people.map((p) => p.id);
  const lineItemsByPerson = initializeLineItemMap(personIds);
  const involvedCountByPerson = initializeCentsMap(personIds);
  const subtotalByPersonCents = initializeCentsMap(personIds);
  const discountByPersonCents = initializeCentsMap(personIds);
  const serviceByPersonCents = initializeCentsMap(personIds);
  const gstByPersonCents = initializeCentsMap(personIds);
  const totalByPersonCents = initializeCentsMap(personIds);

  let subtotalCents = 0;
  let discountCents = 0;
  let serviceChargeCents = 0;
  let gstCents = 0;
  let grandTotalCents = 0;
  let unassignedItemCount = 0;

  for (let i = 0; i < results.length; i++) {
    const fromCurrency = currencies[i] ?? baseCurrency;
    const override = exchangeRateOverrides[i] ?? null;
    const result =
      fromCurrency !== baseCurrency
        ? convertSplitResult(results[i], fromCurrency, baseCurrency, exchangeRates, override)
        : results[i];

    for (const personId of personIds) {
      const lines = result.lineItemsByPerson[personId] ?? [];
      lineItemsByPerson[personId].push(...lines);
      involvedCountByPerson[personId] += result.involvedCountByPerson[personId] ?? 0;
      subtotalByPersonCents[personId] += result.subtotalByPersonCents[personId] ?? 0;
      discountByPersonCents[personId] += result.discountByPersonCents[personId] ?? 0;
      serviceByPersonCents[personId] += result.serviceByPersonCents[personId] ?? 0;
      gstByPersonCents[personId] += result.gstByPersonCents[personId] ?? 0;
      totalByPersonCents[personId] += result.totalByPersonCents[personId] ?? 0;
    }
    subtotalCents += result.subtotalCents;
    discountCents += result.discountCents;
    serviceChargeCents += result.serviceChargeCents;
    gstCents += result.gstCents;
    grandTotalCents += result.grandTotalCents;
    unassignedItemCount += result.unassignedItemCount;
  }

  return {
    lineItemsByPerson,
    involvedCountByPerson,
    subtotalByPersonCents,
    discountByPersonCents,
    serviceByPersonCents,
    gstByPersonCents,
    totalByPersonCents,
    subtotalCents,
    discountCents,
    serviceChargeCents,
    gstCents,
    grandTotalCents,
    unassignedItemCount,
  };
}

function initializeCentsMap(personIds: string[]): Record<string, number> {
  return Object.fromEntries(personIds.map((personId) => [personId, 0]));
}

function initializeLineItemMap(personIds: string[]): Record<string, PersonReceiptLineItem[]> {
  return Object.fromEntries(personIds.map((personId) => [personId, []]));
}

function sumMapValues(values: Record<string, number>): number {
  return Object.values(values).reduce((sum, value) => sum + value, 0);
}

function weightsFromBase(
  base: Record<string, number>,
  personIds: string[],
): Record<string, number> {
  const weights = initializeCentsMap(personIds);

  for (const personId of personIds) {
    weights[personId] = Math.max(base[personId] ?? 0, 0);
  }

  const totalWeight = sumMapValues(weights);
  if (totalWeight > 0) {
    return weights;
  }

  for (const personId of personIds) {
    weights[personId] = 1;
  }

  return weights;
}

function allocateCents(
  totalCents: number,
  personIds: string[],
  rawWeights: Record<string, number>,
): Record<string, number> {
  const allocation = initializeCentsMap(personIds);

  if (personIds.length === 0 || totalCents === 0) {
    return allocation;
  }

  const weights = personIds.map((personId) => ({
    personId,
    weight: Math.max(rawWeights[personId] ?? 0, 0),
  }));

  let totalWeight = weights.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight === 0) {
    for (const entry of weights) {
      entry.weight = 1;
    }
    totalWeight = weights.length;
  }

  const sign = totalCents < 0 ? -1 : 1;
  const absoluteCents = Math.abs(totalCents);

  const baseShares = weights.map((entry) => {
    const exactShare = (absoluteCents * entry.weight) / totalWeight;
    const floorShare = Math.floor(exactShare);

    return {
      personId: entry.personId,
      floorShare,
      fractional: exactShare - floorShare,
    };
  });

  let remainder = absoluteCents - baseShares.reduce((sum, share) => sum + share.floorShare, 0);

  baseShares.sort((a, b) => {
    if (b.fractional !== a.fractional) {
      return b.fractional - a.fractional;
    }
    return a.personId.localeCompare(b.personId);
  });

  for (let index = 0; index < baseShares.length && remainder > 0; index += 1) {
    baseShares[index].floorShare += 1;
    remainder -= 1;
  }

  for (const share of baseShares) {
    allocation[share.personId] = sign * share.floorShare;
  }

  return allocation;
}
