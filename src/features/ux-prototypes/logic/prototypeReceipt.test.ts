import { describe, expect, it } from 'vitest';
import { computeSplit } from '@shared/logic/split/split';
import {
  DINNER_RECEIPT,
  PROTOTYPE_CHARGES,
  setAssignees,
  toEditableItems,
  toggleAssignee,
} from './prototypeReceipt';

describe('prototype receipt', () => {
  it('adds a person who is not yet on the item', () => {
    const next = toggleAssignee({ fries: ['eugene'] }, 'fries', 'sofia');
    expect(next.fries).toEqual(['eugene', 'sofia']);
  });

  it('removes a person who is already on the item', () => {
    const next = toggleAssignee({ fries: ['eugene', 'sofia'] }, 'fries', 'eugene');
    expect(next.fries).toEqual(['sofia']);
  });

  it('starts an assignment for an item with no entry', () => {
    expect(toggleAssignee({}, 'kopi', 'tom').kopi).toEqual(['tom']);
  });

  it('replaces every assignee at once', () => {
    const next = setAssignees({ beer: ['tom'] }, 'beer', ['mei', 'arjun']);
    expect(next.beer).toEqual(['mei', 'arjun']);
  });

  it('leaves the two seeded items unassigned so prototypes show that state', () => {
    const split = computeSplit({
      people: DINNER_RECEIPT.people,
      items: toEditableItems(DINNER_RECEIPT.items, DINNER_RECEIPT.initialAssignments),
      ...PROTOTYPE_CHARGES,
    });
    expect(split.unassignedItemCount).toBe(2);
  });

  it('charges service and GST on the full receipt once everything is assigned', () => {
    const everyone = DINNER_RECEIPT.people.map((person) => person.id);
    const assignments = Object.fromEntries(DINNER_RECEIPT.items.map((item) => [item.id, everyone]));
    const split = computeSplit({
      people: DINNER_RECEIPT.people,
      items: toEditableItems(DINNER_RECEIPT.items, assignments),
      ...PROTOTYPE_CHARGES,
    });
    expect(split.subtotalCents).toBe(12280);
    expect(split.serviceChargeCents).toBe(1228);
  });
});
