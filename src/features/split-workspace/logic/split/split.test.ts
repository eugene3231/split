import { describe, expect, it } from 'vitest';
import type { ChargeState, EditableItem, Person } from '@shared/types';
import { computeSplit } from '@features/split-workspace/logic/split/split';
import { convertSplitResult } from '@features/split-workspace/logic/exchangeRates';
import { NOBODY, equalShares, makeAssignment } from '@features/split-workspace/logic/assignment';
import { centsByPerson } from '@features/split-workspace/logic/split/amounts';
import { makeReceipt } from '../../../../tests/integration/testHelpers';

const disabledCharge: ChargeState = {
  enabled: false,
  mode: 'percent',
  amountInput: '',
  percentInput: '',
  detectedConfidence: null,
  detectedSource: null,
};

describe('computeSplit', () => {
  it('caps a receipt discount at its subtotal before currency conversion', () => {
    const people: Person[] = [{ id: 'alice', name: 'Alice' }];
    const items: EditableItem[] = [
      {
        id: 'meal',
        name: 'Meal',
        amountInput: '10.00',
        discountPercentInput: '',
        assignment: equalShares(['alice']),
      },
    ];
    const discount: ChargeState = {
      ...disabledCharge,
      enabled: true,
      mode: 'amount',
      amountInput: '20.00',
    };

    const split = computeSplit(
      makeReceipt({
        items,
        discount,
        serviceCharge: disabledCharge,
        gst: disabledCharge,
      }),
      people,
    );
    const converted = convertSplitResult(split, 'USD', 'SGD', { USD: 1.35, SGD: 1 });

    expect(split.totals.chargeCents.discount).toBe(1000);
    expect(split.totals.totalCents).toBe(0);
    expect(converted.totals.chargeCents.discount).toBe(1350);
    expect(converted.totals.chargeCents.gst).toBe(0);
    expect(converted.totals.totalCents).toBe(0);
  });

  it('charges a half-claimed item to its claimant at half price', () => {
    const people: Person[] = [
      { id: 'alice', name: 'Alice' },
      { id: 'bob', name: 'Bob' },
    ];
    const items: EditableItem[] = [
      {
        id: 'bread',
        name: 'Garlic bread',
        amountInput: '6.00',
        discountPercentInput: '',
        assignment: makeAssignment({ alice: 1 }, 1),
      },
    ];

    const split = computeSplit(
      makeReceipt({
        items,
        discount: disabledCharge,
        serviceCharge: disabledCharge,
        gst: disabledCharge,
      }),
      people,
    );

    expect(centsByPerson(split, 'total')).toEqual({ alice: 300, bob: 0 });
  });

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
        assignment: equalShares(['p1', 'p2', 'p3']),
      },
    ];

    const split = computeSplit(
      makeReceipt({
        items,
        discount: disabledCharge,
        serviceCharge: disabledCharge,
        gst: disabledCharge,
      }),
      people,
    );

    expect(split.totals.subtotalCents).toBe(1000);
    expect(centsByPerson(split, 'subtotal')).toEqual({
      p1: 334,
      p2: 333,
      p3: 333,
    });
    expect(split.totals.totalCents).toBe(1000);
    expect(centsByPerson(split, 'total')).toEqual({
      p1: 334,
      p2: 333,
      p3: 333,
    });
    expect(split.byPerson.p1.lines[0]?.amountCents).toBe(334);
    expect(split.byPerson.p2.lines[0]?.amountCents).toBe(333);
    expect(split.byPerson.p3.lines[0]?.amountCents).toBe(333);
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
        assignment: equalShares(['alice']),
      },
      {
        id: 'i2',
        name: 'Bob dish',
        amountInput: '20.00',
        discountPercentInput: '',
        assignment: equalShares(['bob']),
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

    const split = computeSplit(
      makeReceipt({ items, discount: disabledCharge, serviceCharge, gst }),
      people,
    );

    // Subtotal = $30, service = $3, gst = 9% of $33 = $2.97 → 297 cents
    expect(split.totals.subtotalCents).toBe(3000);
    expect(split.totals.chargeCents.service).toBe(300);
    expect(split.totals.chargeCents.gst).toBe(297);
    expect(split.totals.totalCents).toBe(3597);

    // Alice: 1/3 of each charge; Bob: 2/3
    expect(split.byPerson.alice.chargeCents.service).toBe(100);
    expect(split.byPerson.bob.chargeCents.service).toBe(200);
    expect(split.byPerson.alice.totalCents + split.byPerson.bob.totalCents).toBe(3597);
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
        assignment: equalShares(['alice']),
      },
      {
        id: 'i2',
        name: 'Bob dish',
        amountInput: '10.00',
        discountPercentInput: '',
        assignment: equalShares(['bob']),
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

    const split = computeSplit(
      makeReceipt({
        items,
        discount,
        serviceCharge: disabledCharge,
        gst: disabledCharge,
      }),
      people,
    );

    expect(split.totals.chargeCents.discount).toBe(400);
    // Equal subtotals → equal discount split
    expect(split.byPerson.alice.chargeCents.discount).toBe(200);
    expect(split.byPerson.bob.chargeCents.discount).toBe(200);
    expect(split.totals.totalCents).toBe(1600);
  });

  it('falls back to Untitled item for items with no name', () => {
    const people: Person[] = [{ id: 'p1', name: 'Alice' }];
    const items: EditableItem[] = [
      {
        id: 'i1',
        name: '   ',
        amountInput: '5.00',
        discountPercentInput: '',
        assignment: equalShares(['p1']),
      },
    ];

    const split = computeSplit(
      makeReceipt({
        items,
        discount: disabledCharge,
        serviceCharge: disabledCharge,
        gst: disabledCharge,
      }),
      people,
    );

    expect(split.byPerson.p1.lines[0]?.name).toBe('Untitled item');
  });

  it('skips zero-net-amount items (fully discounted)', () => {
    const people: Person[] = [{ id: 'p1', name: 'Alice' }];
    const items: EditableItem[] = [
      {
        id: 'i1',
        name: 'Free item',
        amountInput: '5.00',
        discountPercentInput: '100',
        assignment: equalShares(['p1']),
      },
      {
        id: 'i2',
        name: 'Paid item',
        amountInput: '10.00',
        discountPercentInput: '',
        assignment: equalShares(['p1']),
      },
    ];

    const split = computeSplit(
      makeReceipt({
        items,
        discount: disabledCharge,
        serviceCharge: disabledCharge,
        gst: disabledCharge,
      }),
      people,
    );

    expect(split.totals.subtotalCents).toBe(1000);
    expect(split.byPerson.p1.lines).toHaveLength(1);
    expect(split.byPerson.p1.lines[0]?.name).toBe('Paid item');
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
        assignment: equalShares(['alice']),
      },
    ];

    const split = computeSplit(
      makeReceipt({
        items,
        discount: disabledCharge,
        serviceCharge: disabledCharge,
        gst: disabledCharge,
      }),
      people,
    );

    expect(split.byPerson.bob.lines[0].amountCents).toBeNull();
    expect(split.byPerson.alice.lines[0].amountCents).toBe(1200);
  });

  it('leaves out an item nobody in the split is on', () => {
    const people: Person[] = [{ id: 'p1', name: 'Alice' }];

    const items: EditableItem[] = [
      {
        id: 'item-1',
        name: 'Assigned',
        amountInput: '5.00',
        discountPercentInput: '',
        assignment: equalShares(['p1']),
      },
      {
        id: 'item-2',
        name: 'Invalid single assignee',
        amountInput: '10.00',
        discountPercentInput: '',
        assignment: equalShares(['missing']),
      },
      {
        id: 'item-3',
        name: 'Empty equal split',
        amountInput: '2.00',
        discountPercentInput: '',
        assignment: NOBODY,
      },
      {
        id: 'item-4',
        name: 'Invalid amount',
        amountInput: '',
        discountPercentInput: '',
        assignment: equalShares(['missing']),
      },
    ];

    const split = computeSplit(
      makeReceipt({
        items,
        discount: disabledCharge,
        serviceCharge: disabledCharge,
        gst: disabledCharge,
      }),
      people,
    );

    expect(split.totals.subtotalCents).toBe(500);
    expect(split.totals.totalCents).toBe(500);
    expect(split.byPerson.p1.subtotalCents).toBe(500);
    expect(split.byPerson.p1.lines).toHaveLength(1);
  });

  it('handles all-zero weight distribution by falling back to equal weights', () => {
    const people: Person[] = [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Ben' },
    ];

    const items: EditableItem[] = [
      {
        id: 'item-1',
        name: 'Free item',
        amountInput: '0',
        discountPercentInput: '',
        assignment: equalShares(['p1', 'p2']),
      },
      {
        id: 'item-2',
        name: 'Paid item',
        amountInput: '10.00',
        discountPercentInput: '',
        assignment: equalShares(['p1']),
      },
    ];

    const split = computeSplit(
      makeReceipt({
        items,
        discount: { ...disabledCharge, enabled: true, mode: 'amount', amountInput: '0.00' },
        serviceCharge: disabledCharge,
        gst: disabledCharge,
      }),
      people,
    );

    expect(split.totals.totalCents).toBe(1000);
    expect(split.byPerson.p1.totalCents).toBe(1000);
    expect(split.byPerson.p2.totalCents).toBe(0);
  });

  it('distributes fractional remainders correctly across unequal shares', () => {
    const people: Person[] = [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Ben' },
      { id: 'p3', name: 'Cara' },
    ];

    const items: EditableItem[] = [
      {
        id: 'item-1',
        name: 'Expensive',
        amountInput: '100.01',
        discountPercentInput: '',
        assignment: equalShares(['p1', 'p2', 'p3']),
      },
    ];

    const split = computeSplit(
      makeReceipt({
        items,
        discount: disabledCharge,
        serviceCharge: disabledCharge,
        gst: disabledCharge,
      }),
      people,
    );

    const total =
      split.byPerson.p1.totalCents + split.byPerson.p2.totalCents + split.byPerson.p3.totalCents;
    expect(total).toBe(split.totals.totalCents);
  });

  it('distributes charges equally when all subtotals are zero', () => {
    const people: Person[] = [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Ben' },
    ];

    const items: EditableItem[] = [];

    const serviceCharge: ChargeState = {
      enabled: true,
      mode: 'amount',
      amountInput: '10.00',
      percentInput: '',
      detectedConfidence: null,
      detectedSource: null,
    };

    const split = computeSplit(
      makeReceipt({
        items,
        discount: disabledCharge,
        serviceCharge,
        gst: disabledCharge,
      }),
      people,
    );

    expect(split.totals.subtotalCents).toBe(0);
    expect(split.totals.chargeCents.service).toBe(1000);
    expect(split.byPerson.p1.totalCents).toBe(500);
    expect(split.byPerson.p2.totalCents).toBe(500);
    expect(split.totals.totalCents).toBe(1000);
  });

  it('keeps a fixed charge on the people with items when a discount takes the whole subtotal', () => {
    const people: Person[] = [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Ben' },
      { id: 'p3', name: 'Cara' },
    ];
    const items: EditableItem[] = [
      {
        id: 'meal',
        name: 'Meal',
        amountInput: '20.00',
        discountPercentInput: '',
        assignment: equalShares(['p1', 'p2']),
      },
    ];

    const split = computeSplit(
      makeReceipt({
        items,
        discount: { ...disabledCharge, enabled: true, mode: 'percent', percentInput: '100' },
        serviceCharge: { ...disabledCharge, enabled: true, mode: 'amount', amountInput: '3.00' },
        gst: disabledCharge,
      }),
      people,
    );

    expect(centsByPerson(split, 'total')).toEqual({ p1: 150, p2: 150, p3: 0 });
  });

  it('splits a $30 item 2:1 between two people', () => {
    const people: Person[] = [
      { id: 'alice', name: 'Alice' },
      { id: 'bob', name: 'Bob' },
    ];
    const items: EditableItem[] = [
      {
        id: 'i1',
        name: 'Wine bottle',
        amountInput: '30.00',
        discountPercentInput: '',
        assignment: makeAssignment({ alice: 2, bob: 1 }),
      },
    ];

    const split = computeSplit(
      makeReceipt({
        items,
        discount: disabledCharge,
        serviceCharge: disabledCharge,
        gst: disabledCharge,
      }),
      people,
    );

    expect(split.totals.subtotalCents).toBe(3000);
    expect(split.byPerson.alice.subtotalCents).toBe(2000);
    expect(split.byPerson.bob.subtotalCents).toBe(1000);
    expect(split.byPerson.alice.lines[0]?.amountCents).toBe(2000);
    expect(split.byPerson.bob.lines[0]?.amountCents).toBe(1000);
  });

  it('splits equally when weights are all 1 (same as no weights)', () => {
    const people: Person[] = [
      { id: 'alice', name: 'Alice' },
      { id: 'bob', name: 'Bob' },
    ];
    const items: EditableItem[] = [
      {
        id: 'i1',
        name: 'Shared dish',
        amountInput: '20.00',
        discountPercentInput: '',
        assignment: makeAssignment({ alice: 1, bob: 1 }),
      },
    ];

    const split = computeSplit(
      makeReceipt({
        items,
        discount: disabledCharge,
        serviceCharge: disabledCharge,
        gst: disabledCharge,
      }),
      people,
    );

    expect(split.byPerson.alice.subtotalCents).toBe(1000);
    expect(split.byPerson.bob.subtotalCents).toBe(1000);
  });

  it('handles remainder correctly in a 2:1 split of an indivisible amount', () => {
    const people: Person[] = [
      { id: 'alice', name: 'Alice' },
      { id: 'bob', name: 'Bob' },
    ];
    const items: EditableItem[] = [
      {
        id: 'i1',
        name: 'Odd amount',
        amountInput: '10.00',
        discountPercentInput: '',
        assignment: makeAssignment({ alice: 2, bob: 1 }),
      },
    ];

    const split = computeSplit(
      makeReceipt({
        items,
        discount: disabledCharge,
        serviceCharge: disabledCharge,
        gst: disabledCharge,
      }),
      people,
    );

    // $10 split 2:1 → alice $6.67, bob $3.33 (remainder to alice via largest-remainder)
    expect(split.byPerson.alice.subtotalCents).toBe(667);
    expect(split.byPerson.bob.subtotalCents).toBe(333);
    expect(split.byPerson.alice.subtotalCents + split.byPerson.bob.subtotalCents).toBe(1000);
  });

  it('adds rounding after tax, split evenly between everyone on the receipt', () => {
    const people: Person[] = [
      { id: 'alice', name: 'Alice' },
      { id: 'bob', name: 'Bob' },
      { id: 'cara', name: 'Cara' },
    ];
    const items: EditableItem[] = [
      {
        id: 'steak',
        name: 'Steak',
        amountInput: '30.00',
        discountPercentInput: '',
        assignment: equalShares(['alice']),
      },
      {
        id: 'salad',
        name: 'Salad',
        amountInput: '10.00',
        discountPercentInput: '',
        assignment: equalShares(['bob']),
      },
    ];

    const split = computeSplit(
      makeReceipt({
        items,
        discount: disabledCharge,
        serviceCharge: disabledCharge,
        gst: { ...disabledCharge, enabled: true, percentInput: '9' },
        roundingInput: '0.41',
      }),
      people,
    );

    expect(split.totals.chargeCents.gst).toBe(360);
    expect(split.totals.chargeCents.rounding).toBe(41);
    expect(centsByPerson(split, 'rounding')).toEqual({ alice: 21, bob: 20, cara: 0 });
    expect(split.totals.totalCents).toBe(4401);
    expect(centsByPerson(split, 'total')).toEqual({ alice: 3291, bob: 1110, cara: 0 });
  });

  it('keeps rounding as its own line through currency conversion', () => {
    const people: Person[] = [{ id: 'alice', name: 'Alice' }];
    const split = computeSplit(
      makeReceipt({
        items: [
          {
            id: 'meal',
            name: 'Meal',
            amountInput: '10.00',
            discountPercentInput: '',
            assignment: equalShares(['alice']),
          },
        ],
        discount: disabledCharge,
        serviceCharge: disabledCharge,
        gst: disabledCharge,
        roundingInput: '1.00',
      }),
      people,
    );

    const converted = convertSplitResult(split, 'USD', 'SGD', { USD: 1.35 });

    expect(converted.totals.chargeCents.rounding).toBe(135);
    expect(converted.byPerson.alice.chargeCents.rounding).toBe(135);
    expect(converted.totals.totalCents).toBe(1485);
  });
});
