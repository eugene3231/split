import type { EditableItem, Person } from '@shared/types';
import { resolveDiscountedAmountCents } from '@shared/logic/split/pricing';
import type { WizardStep } from '@features/split-workspace/types';

export function hasAnyValidReceiptItem(items: EditableItem[]): boolean {
  return items.some((item) => resolveDiscountedAmountCents(item) !== null);
}

export function getDetectedItemsCount(items: EditableItem[]): number {
  return items.filter((item) => resolveDiscountedAmountCents(item) !== null).length;
}

export function getAssignedItemsCount(items: EditableItem[], people: Person[]): number {
  const validPeople = new Set(people.map((person) => person.id));

  return items.filter((item) => isItemAssigned(item, validPeople)).length;
}

export function isItemAssigned(item: EditableItem, validPeople: Set<string>): boolean {
  if (item.assignment.mode !== 'equal') {
    return false;
  }

  const selected = item.assignment.personIds.filter((personId) => validPeople.has(personId));
  return selected.length > 0;
}

export function isStepValid(
  step: WizardStep,
  args: { items: EditableItem[]; people: Person[] },
): boolean {
  if (step === 'people') {
    return args.people.length > 0;
  }

  if (step === 'receipt') {
    return hasAnyValidReceiptItem(args.items);
  }

  if (step === 'items') {
    const detectedCount = getDetectedItemsCount(args.items);
    if (detectedCount === 0) {
      return false;
    }

    return getAssignedItemsCount(args.items, args.people) === detectedCount;
  }

  return true;
}
