import type { EditableItem, Person } from '@shared/types';
import { isItemAssigned } from '@features/split-workspace/logic/assignment';
import { resolveDiscountedAmountCents } from '@features/split-workspace/logic/split/pricing';
import type { WizardStep } from '@features/split-workspace/types';

export function hasAnyValidReceiptItem(items: EditableItem[]): boolean {
  return items.some((item) => resolveDiscountedAmountCents(item) !== null);
}

export function getDetectedItemsCount(items: EditableItem[]): number {
  return items.filter((item) => resolveDiscountedAmountCents(item) !== null).length;
}

export function getAssignedItemsCount(items: EditableItem[], people: Person[]): number {
  const validPeople = new Set(people.map((person) => person.id));

  return items.filter(
    (item) => resolveDiscountedAmountCents(item) !== null && isItemAssigned(item, validPeople),
  ).length;
}

/** At least one item has a price, and every priced item is assigned to someone in `people`. */
export function isEveryPricedItemAssigned(items: EditableItem[], people: Person[]): boolean {
  const detectedCount = getDetectedItemsCount(items);
  return detectedCount > 0 && getAssignedItemsCount(items, people) === detectedCount;
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
    return isEveryPricedItemAssigned(args.items, args.people);
  }

  return true;
}
