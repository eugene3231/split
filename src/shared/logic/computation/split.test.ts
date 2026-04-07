import { describe, expect, it } from 'vitest';
import type { ChargeState, EditableItem, Person } from '@shared/types';
import { computeSplit } from '@shared/logic/computation/split';

const disabledCharge: ChargeState = {
  enabled: false,
  mode: 'percent',
  amountInput: '',
  percentInput: '',
  detectedConfidence: null,
  detectedSource: null,
};

describe('computeSplit', () => {
  it('allocates equal split remainders deterministically', () => {
    const people: Person[] = [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Ben' },
      { id: 'p3', name: 'Cara' },
    ];

    const items: EditableItem[] = [
      {
        id: 'item-1',
        name: 'Shared fries',
        amountInput: '10.00',
        discountPercentInput: '',
        assignment: {
          mode: 'equal',
          personId: '',
          personIds: ['p1', 'p2', 'p3'],
        },
      },
    ];

    const split = computeSplit({
      people,
      items,
      discount: disabledCharge,
      serviceCharge: disabledCharge,
      gst: disabledCharge,
    });

    expect(split.subtotalCents).toBe(1000);
    expect(split.subtotalByPersonCents).toEqual({
      p1: 334,
      p2: 333,
      p3: 333,
    });
    expect(split.grandTotalCents).toBe(1000);
    expect(split.totalByPersonCents).toEqual({
      p1: 334,
      p2: 333,
      p3: 333,
    });
    expect(split.lineItemsByPerson.p1[0]?.assignedAmountCents).toBe(334);
    expect(split.lineItemsByPerson.p2[0]?.assignedAmountCents).toBe(333);
    expect(split.lineItemsByPerson.p3[0]?.assignedAmountCents).toBe(333);
  });

  it('applies service charge and gst proportionally', () => {
    // Alice orders $10, Bob orders $20. Service charge 10%, GST 9% on subtotal+service.
    const people: Person[] = [
      { id: 'alice', name: 'Alice' },
      { id: 'bob', name: 'Bob' },
    ];
    const items: EditableItem[] = [
      {
        id: 'i1',
        name: 'Alice dish',
        amountInput: '10.00',
        discountPercentInput: '',
        assignment: { mode: 'single', personId: 'alice', personIds: ['alice'] },
      },
      {
        id: 'i2',
        name: 'Bob dish',
        amountInput: '20.00',
        discountPercentInput: '',
        assignment: { mode: 'single', personId: 'bob', personIds: ['bob'] },
      },
    ];
    const serviceCharge: ChargeState = {
      enabled: true,
      mode: 'percent',
      amountInput: '',
      percentInput: '10',
      detectedConfidence: null,
      detectedSource: null,
    };
    const gst: ChargeState = {
      enabled: true,
      mode: 'percent',
      amountInput: '',
      percentInput: '9',
      detectedConfidence: null,
      detectedSource: null,
    };

    const split = computeSplit({ people, items, discount: disabledCharge, serviceCharge, gst });

    // Subtotal = $30, service = $3, gst = 9% of $33 = $2.97 → 297 cents
    expect(split.subtotalCents).toBe(3000);
    expect(split.serviceChargeCents).toBe(300);
    expect(split.gstCents).toBe(297);
    expect(split.grandTotalCents).toBe(3597);

    // Alice: 1/3 of each charge; Bob: 2/3
    expect(split.serviceByPersonCents.alice).toBe(100);
    expect(split.serviceByPersonCents.bob).toBe(200);
    expect(split.totalByPersonCents.alice + split.totalByPersonCents.bob).toBe(3597);
  });

  it('applies a global discount proportionally to subtotals', () => {
    const people: Person[] = [
      { id: 'alice', name: 'Alice' },
      { id: 'bob', name: 'Bob' },
    ];
    const items: EditableItem[] = [
      {
        id: 'i1',
        name: 'Alice dish',
        amountInput: '10.00',
        discountPercentInput: '',
        assignment: { mode: 'single', personId: 'alice', personIds: ['alice'] },
      },
      {
        id: 'i2',
        name: 'Bob dish',
        amountInput: '10.00',
        discountPercentInput: '',
        assignment: { mode: 'single', personId: 'bob', personIds: ['bob'] },
      },
    ];
    const discount: ChargeState = {
      enabled: true,
      mode: 'amount',
      amountInput: '4.00',
      percentInput: '',
      detectedConfidence: null,
      detectedSource: null,
    };

    const split = computeSplit({
      people,
      items,
      discount,
      serviceCharge: disabledCharge,
      gst: disabledCharge,
    });

    expect(split.discountCents).toBe(400);
    // Equal subtotals → equal discount split
    expect(split.discountByPersonCents.alice).toBe(200);
    expect(split.discountByPersonCents.bob).toBe(200);
    expect(split.grandTotalCents).toBe(1600);
  });

  it('falls back to Untitled item for items with no name', () => {
    const people: Person[] = [{ id: 'p1', name: 'Alice' }];
    const items: EditableItem[] = [
      {
        id: 'i1',
        name: '   ',
        amountInput: '5.00',
        discountPercentInput: '',
        assignment: { mode: 'single', personId: 'p1', personIds: ['p1'] },
      },
    ];

    const split = computeSplit({
      people,
      items,
      discount: disabledCharge,
      serviceCharge: disabledCharge,
      gst: disabledCharge,
    });

    expect(split.lineItemsByPerson.p1[0]?.name).toBe('Untitled item');
  });

  it('skips zero-net-amount items (fully discounted)', () => {
    const people: Person[] = [{ id: 'p1', name: 'Alice' }];
    const items: EditableItem[] = [
      {
        id: 'i1',
        name: 'Free item',
        amountInput: '5.00',
        discountPercentInput: '100',
        assignment: { mode: 'single', personId: 'p1', personIds: ['p1'] },
      },
      {
        id: 'i2',
        name: 'Paid item',
        amountInput: '10.00',
        discountPercentInput: '',
        assignment: { mode: 'single', personId: 'p1', personIds: ['p1'] },
      },
    ];

    const split = computeSplit({
      people,
      items,
      discount: disabledCharge,
      serviceCharge: disabledCharge,
      gst: disabledCharge,
    });

    expect(split.subtotalCents).toBe(1000);
    expect(split.lineItemsByPerson.p1).toHaveLength(1);
    expect(split.lineItemsByPerson.p1[0]?.name).toBe('Paid item');
  });

  it('records non-involved line items for people who did not order an item', () => {
    const people: Person[] = [
      { id: 'alice', name: 'Alice' },
      { id: 'bob', name: 'Bob' },
    ];
    const items: EditableItem[] = [
      {
        id: 'i1',
        name: 'Alice only',
        amountInput: '12.00',
        discountPercentInput: '',
        assignment: { mode: 'single', personId: 'alice', personIds: ['alice'] },
      },
    ];

    const split = computeSplit({
      people,
      items,
      discount: disabledCharge,
      serviceCharge: disabledCharge,
      gst: disabledCharge,
    });

    const bobLine = split.lineItemsByPerson.bob[0];
    expect(bobLine?.involved).toBe(false);
    expect(bobLine?.assignedAmountCents).toBe(0);
    expect(bobLine?.grossAmountCents).toBe(1200);
    expect(split.involvedCountByPerson.alice).toBe(1);
    expect(split.involvedCountByPerson.bob).toBe(0);
  });

  it('excludes unassigned items and counts them', () => {
    const people: Person[] = [{ id: 'p1', name: 'Alice' }];

    const items: EditableItem[] = [
      {
        id: 'item-1',
        name: 'Assigned',
        amountInput: '5.00',
        discountPercentInput: '',
        assignment: {
          mode: 'single',
          personId: 'p1',
          personIds: ['p1'],
        },
      },
      {
        id: 'item-2',
        name: 'Invalid single assignee',
        amountInput: '10.00',
        discountPercentInput: '',
        assignment: {
          mode: 'single',
          personId: 'missing',
          personIds: [],
        },
      },
      {
        id: 'item-3',
        name: 'Empty equal split',
        amountInput: '2.00',
        discountPercentInput: '',
        assignment: {
          mode: 'equal',
          personId: '',
          personIds: [],
        },
      },
      {
        id: 'item-4',
        name: 'Invalid amount',
        amountInput: '',
        discountPercentInput: '',
        assignment: {
          mode: 'single',
          personId: 'missing',
          personIds: [],
        },
      },
    ];

    const split = computeSplit({
      people,
      items,
      discount: disabledCharge,
      serviceCharge: disabledCharge,
      gst: disabledCharge,
    });

    expect(split.unassignedItemCount).toBe(2);
    expect(split.subtotalCents).toBe(500);
    expect(split.grandTotalCents).toBe(500);
    expect(split.subtotalByPersonCents.p1).toBe(500);
    expect(split.lineItemsByPerson.p1).toHaveLength(1);
  });
});
