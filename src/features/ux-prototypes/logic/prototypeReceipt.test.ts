import { describe, expect, it } from 'vitest';
import { computeSplit } from '@shared/logic/split/split';
import {
  PROTOTYPE_CHARGES,
  PROTOTYPE_INITIAL_ASSIGNMENTS,
  PROTOTYPE_ITEMS,
  PROTOTYPE_PEOPLE,
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
      people: PROTOTYPE_PEOPLE,
      items: toEditableItems(PROTOTYPE_ITEMS, PROTOTYPE_INITIAL_ASSIGNMENTS),
      ...PROTOTYPE_CHARGES,
    });
    expect(split.unassignedItemCount).toBe(2);
  });

  it('charges service and GST on the full receipt once everything is assigned', () => {
    const everyone = PROTOTYPE_PEOPLE.map((person) => person.id);
    const assignments = Object.fromEntries(PROTOTYPE_ITEMS.map((item) => [item.id, everyone]));
    const split = computeSplit({
      people: PROTOTYPE_PEOPLE,
      items: toEditableItems(PROTOTYPE_ITEMS, assignments),
      ...PROTOTYPE_CHARGES,
    });
    expect(split.subtotalCents).toBe(12280);
    expect(split.serviceChargeCents).toBe(1228);
  });
});
