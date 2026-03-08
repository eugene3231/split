import type {
  ChargeState,
  EditableItem,
  Person,
  PersonReceiptLineItem,
  SplitResult,
} from '../../types'
import { parseCurrencyToCents } from '../core/money'
import { resolveChargeCents } from './charges'
import { parseDiscountPercent, resolveDiscountedAmountCents } from './pricing'

export function computeSplit({
  people,
  items,
  discount,
  serviceCharge,
  gst,
}: {
  people: Person[]
  items: EditableItem[]
  discount: ChargeState
  serviceCharge: ChargeState
  gst: ChargeState
}): SplitResult {
  const personIds = people.map((person) => person.id)
  const validPeopleSet = new Set(personIds)

  const lineItemsByPerson = initializeLineItemMap(personIds)
  const subtotalByPersonCents = initializeCentsMap(personIds)
  let unassignedItemCount = 0

  for (const item of items) {
    const netAmountCents = resolveDiscountedAmountCents(item)

    if (netAmountCents === null || netAmountCents === 0) {
      continue
    }

    const grossAmountCents = parseCurrencyToCents(item.amountInput) ?? netAmountCents
    const discountPercent = parseDiscountPercent(item.discountPercentInput)
    const itemName = item.name.trim() || 'Untitled item'

    if (item.assignment.mode === 'single') {
      if (!validPeopleSet.has(item.assignment.personId)) {
        unassignedItemCount += 1
        continue
      }

      subtotalByPersonCents[item.assignment.personId] += netAmountCents
      lineItemsByPerson[item.assignment.personId].push({
        itemId: item.id,
        name: itemName,
        grossAmountCents,
        discountPercent,
        discountAmountCents: Math.max(0, grossAmountCents - netAmountCents),
        netAmountCents,
        assignedAmountCents: netAmountCents,
        splitCount: 1,
      })
      continue
    }

    const selectedIds = Array.from(
      new Set(item.assignment.personIds.filter((personId) => validPeopleSet.has(personId))),
    )

    if (selectedIds.length === 0) {
      unassignedItemCount += 1
      continue
    }

    const equalWeights = Object.fromEntries(selectedIds.map((personId) => [personId, 1]))
    const netSplitAmounts = allocateCents(netAmountCents, selectedIds, equalWeights)
    const grossSplitAmounts = allocateCents(grossAmountCents, selectedIds, equalWeights)

    for (const personId of selectedIds) {
      const assignedAmountCents = netSplitAmounts[personId]
      const grossShareCents = grossSplitAmounts[personId]

      subtotalByPersonCents[personId] += assignedAmountCents
      lineItemsByPerson[personId].push({
        itemId: item.id,
        name: itemName,
        grossAmountCents: grossShareCents,
        discountPercent,
        discountAmountCents: Math.max(0, grossShareCents - assignedAmountCents),
        netAmountCents: assignedAmountCents,
        assignedAmountCents,
        splitCount: selectedIds.length,
      })
    }
  }

  const subtotalCents = sumMapValues(subtotalByPersonCents)
  const discountCents = resolveChargeCents(discount, subtotalCents, subtotalCents)
  const discountWeights = weightsFromBase(subtotalByPersonCents, personIds)
  const discountByPersonCents = allocateCents(discountCents, personIds, discountWeights)

  const discountedSubtotalByPersonCents = initializeCentsMap(personIds)
  for (const personId of personIds) {
    discountedSubtotalByPersonCents[personId] = Math.max(
      0,
      subtotalByPersonCents[personId] - discountByPersonCents[personId],
    )
  }
  const discountedSubtotalCents = sumMapValues(discountedSubtotalByPersonCents)

  const serviceChargeCents = resolveChargeCents(serviceCharge, discountedSubtotalCents, discountedSubtotalCents)
  const serviceWeights = weightsFromBase(discountedSubtotalByPersonCents, personIds)
  const serviceByPersonCents = allocateCents(serviceChargeCents, personIds, serviceWeights)

  const gstBaseCents = discountedSubtotalCents + serviceChargeCents
  const gstCents = resolveChargeCents(gst, discountedSubtotalCents, gstBaseCents)

  const gstWeightSeed = initializeCentsMap(personIds)
  for (const personId of personIds) {
    gstWeightSeed[personId] = Math.max(
      0,
      discountedSubtotalByPersonCents[personId] + serviceByPersonCents[personId],
    )
  }

  const gstWeights = weightsFromBase(gstWeightSeed, personIds)
  const gstByPersonCents = allocateCents(gstCents, personIds, gstWeights)

  const totalByPersonCents = initializeCentsMap(personIds)
  for (const personId of personIds) {
    totalByPersonCents[personId] =
      discountedSubtotalByPersonCents[personId] + serviceByPersonCents[personId] + gstByPersonCents[personId]
  }

  const grandTotalCents = sumMapValues(totalByPersonCents)

  return {
    lineItemsByPerson,
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
  }
}

function initializeCentsMap(personIds: string[]): Record<string, number> {
  return Object.fromEntries(personIds.map((personId) => [personId, 0]))
}

function initializeLineItemMap(personIds: string[]): Record<string, PersonReceiptLineItem[]> {
  return Object.fromEntries(personIds.map((personId) => [personId, []]))
}

function sumMapValues(values: Record<string, number>): number {
  return Object.values(values).reduce((sum, value) => sum + value, 0)
}

function weightsFromBase(base: Record<string, number>, personIds: string[]): Record<string, number> {
  const weights = initializeCentsMap(personIds)

  for (const personId of personIds) {
    weights[personId] = Math.max(base[personId] ?? 0, 0)
  }

  const totalWeight = sumMapValues(weights)
  if (totalWeight > 0) {
    return weights
  }

  for (const personId of personIds) {
    weights[personId] = 1
  }

  return weights
}

function allocateCents(
  totalCents: number,
  personIds: string[],
  rawWeights: Record<string, number>,
): Record<string, number> {
  const allocation = initializeCentsMap(personIds)

  if (personIds.length === 0 || totalCents === 0) {
    return allocation
  }

  const weights = personIds.map((personId) => ({
    personId,
    weight: Math.max(rawWeights[personId] ?? 0, 0),
  }))

  let totalWeight = weights.reduce((sum, entry) => sum + entry.weight, 0)
  if (totalWeight === 0) {
    for (const entry of weights) {
      entry.weight = 1
    }
    totalWeight = weights.length
  }

  const sign = totalCents < 0 ? -1 : 1
  const absoluteCents = Math.abs(totalCents)

  const baseShares = weights.map((entry) => {
    const exactShare = (absoluteCents * entry.weight) / totalWeight
    const floorShare = Math.floor(exactShare)

    return {
      personId: entry.personId,
      floorShare,
      fractional: exactShare - floorShare,
    }
  })

  let remainder = absoluteCents - baseShares.reduce((sum, share) => sum + share.floorShare, 0)

  baseShares.sort((a, b) => {
    if (b.fractional !== a.fractional) {
      return b.fractional - a.fractional
    }
    return a.personId.localeCompare(b.personId)
  })

  for (let index = 0; index < baseShares.length && remainder > 0; index += 1) {
    baseShares[index].floorShare += 1
    remainder -= 1
  }

  for (const share of baseShares) {
    allocation[share.personId] = sign * share.floorShare
  }

  return allocation
}
