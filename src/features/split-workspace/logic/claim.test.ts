import { describe, expect, it } from 'vitest';
import type { EditableItem, ItemAssignment, Person, Receipt } from '@shared/types';
import {
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '@features/split-workspace/constants';
import {
  firstName,
  resolveActivePersonId,
  countItemsLeft,
  formatItemCount,
  resolveClaimContinue,
  resolveClaimView,
  resolvePreviousPersonId,
} from './claim';

const people: Person[] = [
  { id: 'p1', name: 'Eugene Chua' },
  { id: 'p2', name: 'Mei' },
  { id: 'p3', name: 'Arjun' },
];

function makeItem(
  id: string,
  amountInput: string,
  assignment: Partial<ItemAssignment> = {},
  name = `Item ${id}`,
): EditableItem {
  return {
    id,
    name,
    amountInput,
    discountPercentInput: '',
    assignment: { mode: 'equal', personId: '', personIds: [], ...assignment },
  };
}

function makeReceipt(id: string, items: EditableItem[], currency = 'SGD'): Receipt {
  return {
    id,
    name: `Receipt ${id}`,
    items,
    discount: { ...defaultDiscountState },
    serviceCharge: { ...defaultServiceChargeState },
    gst: { ...defaultGstState },
    receiptTotalInput: '',
    roundingInput: '',
    currency,
    exchangeRateOverride: null,
  };
}

function view(receipts: Receipt[], activePersonId = 'p1') {
  return resolveClaimView({
    receipts,
    people,
    activePersonId,
    totalByPersonCents: { p1: 1234, p2: 500 },
    totalsCurrency: 'SGD',
  });
}

function items(receipts: Receipt[], activePersonId = 'p1') {
  return view(receipts, activePersonId).sections.flatMap((section) => section.items);
}

describe('resolveClaimView', () => {
  it('marks only the active person and labels running totals in the totals currency', () => {
    const result = view([makeReceipt('r1', [makeItem('i1', '8.50')])], 'p2');

    expect(result.activePerson).toMatchObject({ id: 'p2', firstName: 'Mei', totalCents: 500 });
    expect(result.people.map((person) => person.isActive)).toEqual([false, true, false]);
    expect(result.people[0]).toMatchObject({
      firstName: 'Eugene',
      totalCents: 1234,
    });
    expect(result.people[2].totalCents).toBe(0);
  });

  it('falls back to the first person when the active person no longer exists', () => {
    const result = view([makeReceipt('r1', [makeItem('i1', '8.50')])], 'gone');

    expect(result.activePerson?.id).toBe('p1');
  });

  it('shows an item nobody has as left, at full price, with no share', () => {
    const [item] = items([makeReceipt('r1', [makeItem('i1', '8.50')])]);

    expect(item).toMatchObject({
      priceLabel: '$8.50',
      claimedByActive: false,
      isLeft: true,
      claimants: [],
      leftLabel: null,
      share: null,
    });
  });

  it("gives the active person's slice and lists who has the item in people order", () => {
    const receipt = makeReceipt('r1', [makeItem('i1', '9.00', { personIds: ['p3', 'p1', 'p2'] })]);

    const [item] = items([receipt]);

    expect(item.claimants.map((person) => person.firstName)).toEqual(['Eugene', 'Mei', 'Arjun']);
    expect(item.claimants[2]).toMatchObject({ name: 'Arjun', colorIndex: 2 });
    expect(item.isLeft).toBe(false);
    expect(item.share).toMatchObject({ label: '1/3', amountLabel: '$3.00' });
  });

  it('offers to split evenly or take the item alone only when that would change it', () => {
    const receipt = makeReceipt('r1', [
      makeItem('even', '9.00', { personIds: ['p1', 'p2', 'p3'] }),
      makeItem('weighted', '9.00', {
        personIds: ['p1', 'p2', 'p3'],
        weights: { p1: 2, p2: 1, p3: 1 },
      }),
      makeItem('solo', '9.00', { personIds: ['p1'] }),
      makeItem('half', '9.00', { personIds: ['p1'], weights: { p1: 1 }, unassignedWeight: 1 }),
    ]);

    const shares = Object.fromEntries(items([receipt]).map((item) => [item.id, item.share]));

    expect(shares.even).toMatchObject({ canSplitEvenly: false, canTakeAlone: true });
    expect(shares.weighted).toMatchObject({ canSplitEvenly: true, canTakeAlone: true });
    expect(shares.solo).toMatchObject({ canSplitEvenly: true, canTakeAlone: false });
    expect(shares.half).toMatchObject({ canSplitEvenly: true, canTakeAlone: true });
  });

  it('says how much of a half-claimed item is still left', () => {
    const receipt = makeReceipt('r1', [
      makeItem('i1', '6.00', { personIds: ['p1'], weights: { p1: 1 }, unassignedWeight: 1 }),
    ]);

    const [item] = items([receipt], 'p2');

    expect(item).toMatchObject({ leftLabel: '1/2 left', isLeft: true, share: null });
    expect(item.claimants.map((person) => person.id)).toEqual(['p1']);
  });

  it('ignores stale person ids on an assignment', () => {
    const receipt = makeReceipt('r1', [makeItem('i1', '6.00', { personIds: ['p2', 'removed'] })]);

    expect(items([receipt])[0].claimants.map((person) => person.id)).toEqual(['p2']);
  });

  it('prices items after their line discount in the receipt currency', () => {
    const discounted = { ...makeItem('i1', '10.00'), discountPercentInput: '10' };
    const receipt = makeReceipt('r1', [discounted], 'USD');

    expect(items([receipt])[0].priceLabel).toBe('US$9.00');
  });

  it('leaves out blank rows without a price and names untitled items', () => {
    const receipt = makeReceipt('r1', [makeItem('blank', ''), makeItem('i1', '4.00', {}, '  ')]);

    const result = items([receipt]);

    expect(result.map((item) => item.id)).toEqual(['i1']);
    expect(result[0].name).toBe('Untitled item');
  });

  it('lists every receipt as its own section and counts what is left', () => {
    const receipts = [
      makeReceipt('r1', [makeItem('a', '5.00', { personIds: ['p1'] }), makeItem('b', '6.00')]),
      makeReceipt('r2', [makeItem('c', '7.00'), makeItem('d', '2.00'), makeItem('blank', '')]),
    ];

    const result = view(receipts);

    expect(result.sections.map((section) => [section.receiptId, section.items.length])).toEqual([
      ['r1', 2],
      ['r2', 2],
    ]);
    expect(result.leftCount).toBe(3);
    expect(result.people.map((person) => person.itemCount)).toEqual([1, 0, 0]);
  });
});

describe('countItemsLeft', () => {
  it('counts unassigned, stale and half-claimed items as left', () => {
    const receipts = [
      makeReceipt('r1', [
        makeItem('a', '5.00', { personIds: ['removed'] }),
        makeItem('b', '5.00', { personIds: ['p1'], unassignedWeight: 1 }),
        makeItem('c', '5.00', { personIds: ['p1'] }),
      ]),
    ];

    expect(countItemsLeft(receipts, people)).toBe(2);
  });
});

describe('formatItemCount', () => {
  it('pluralises items', () => {
    expect(formatItemCount(1)).toBe('1 item');
    expect(formatItemCount(3)).toBe('3 items');
  });
});

describe('resolveClaimContinue', () => {
  it('moves on to the next person by first name', () => {
    expect(resolveClaimContinue(people, 'p2', 4)).toEqual({
      kind: 'next-person',
      personId: 'p3',
      label: 'Next: Arjun',
    });
  });

  it('offers to split leftovers evenly on the last person', () => {
    expect(resolveClaimContinue(people, 'p3', 2)).toEqual({
      kind: 'split-leftovers',
      label: 'Split 2 left evenly',
    });
  });

  it('goes to the summary on the last person once everything is claimed', () => {
    expect(resolveClaimContinue(people, 'p3', 0)).toEqual({
      kind: 'see-summary',
      label: 'See summary',
    });
  });
});

describe('resolvePreviousPersonId', () => {
  it('steps back one person, and gives null on the first or an unknown person', () => {
    expect(resolvePreviousPersonId(people, 'p3')).toBe('p2');
    expect(resolvePreviousPersonId(people, 'p1')).toBeNull();
    expect(resolvePreviousPersonId(people, 'gone')).toBeNull();
  });
});

describe('resolveActivePersonId', () => {
  it('keeps a valid person and falls back to the first, or empty with nobody', () => {
    expect(resolveActivePersonId('p2', people)).toBe('p2');
    expect(resolveActivePersonId('gone', people)).toBe('p1');
    expect(resolveActivePersonId('gone', [])).toBe('');
  });
});

describe('firstName', () => {
  it('takes the first word of a trimmed name', () => {
    expect(firstName('  Alexandra Konstantinopoulou ')).toBe('Alexandra');
    expect(firstName('Mei')).toBe('Mei');
  });
});
