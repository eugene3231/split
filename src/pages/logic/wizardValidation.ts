import type { EditableItem, Person } from '../../shared/types'
import { resolveDiscountedAmountCents } from '../../shared/logic/computation/pricing'
import type { SimpleWizardStep } from '../types'

export function hasAnyValidReceiptItem(items: EditableItem[]): boolean {
  return items.some((item) => resolveDiscountedAmountCents(item) !== null)
}

export function getDetectedItemsCount(items: EditableItem[]): number {
  return items.filter((item) => resolveDiscountedAmountCents(item) !== null).length
}

export function getAssignedItemsCount(items: EditableItem[], people: Person[]): number {
  const validPeople = new Set(people.map((person) => person.id))

  return items.filter((item) => isSimpleItemAssigned(item, validPeople)).length
}

export function isSimpleItemAssigned(item: EditableItem, validPeople: Set<string>): boolean {
  if (item.assignment.mode !== 'equal') {
    return false
  }

  const selected = item.assignment.personIds.filter((personId) => validPeople.has(personId))
  return selected.length > 0
}

export function isStepValid(step: SimpleWizardStep, args: { items: EditableItem[]; people: Person[] }): boolean {
  if (step === 'people') {
    return args.people.length > 0
  }

  if (step === 'receipt') {
    return hasAnyValidReceiptItem(args.items)
  }

  if (step === 'items') {
    const detectedCount = getDetectedItemsCount(args.items)
    if (detectedCount === 0) {
      return false
    }

    return getAssignedItemsCount(args.items, args.people) === detectedCount
  }

  return true
}
