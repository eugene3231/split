import { describe, expect, it } from 'vitest';
import type { EditableItem, ItemAssignment, Person, Receipt } from '@shared/types';
import { NOBODY, equalShares, makeAssignment } from './assignment';
import {
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '@features/split-workspace/constants';
import {
  firstName,
  resolveActivePersonId,
  countItems,
  countItemsLeft,
  listItemsLeft,
  resolveClaimContinue,
  resolveClaimView,
  resolveItemClaimView,
  resolveNextOpenItemId,
  resolvePreviousPersonId,
} from './claim';
import type { ClaimChip } from './claim';
import type { CurrencyCode } from '@shared/constants';

const people: Person[] = [
  { id: 'p1', name: 'Eugene Chua' },
  { id: 'p2', name: 'Mei' },
  { id: 'p3', name: 'Arjun' },
];

function makeItem(
  id: string,
  amountInput: string,
  assignment: ItemAssignment = NOBODY,
  name = `Item ${id}`,
): EditableItem {
  return {
    id,
    name,
    amountInput,
    discountPercentInput: '',
    assignment,
  };
}

function makeReceipt(id: string, items: EditableItem[], currency: CurrencyCode = 'SGD'): Receipt {
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

  it('reports whether the active person is on none, some or all of a receipt', () => {
    const receipts = [
      makeReceipt('r1', [
        makeItem('i1', '8.50', equalShares(['p1'])),
        makeItem('i2', '4.00', equalShares(['p1', 'p2'])),
      ]),
      makeReceipt('r2', [makeItem('i3', '8.50', equalShares(['p1'])), makeItem('i4', '4.00')]),
      makeReceipt('r3', [makeItem('i5', '8.50')]),
    ];

    expect(view(receipts).sections.map((section) => section.activeSelection)).toEqual([
      'all',
      'some',
      'none',
    ]);
    expect(view(receipts, 'p2').sections[0].activeSelection).toBe('some');
  });

  it('flags a custom share only for an uneven or part-assigned item the active person is on', () => {
    const custom = (assignment: ItemAssignment, activePersonId = 'p1') =>
      view([makeReceipt('r1', [makeItem('i1', '9.00', assignment)])], activePersonId).sections[0]
        .activeHasCustomShare;

    expect(custom(equalShares(['p1', 'p2']))).toBe(false);
    expect(custom(makeAssignment({ p1: 1, p2: 1 }))).toBe(false);
    expect(custom(makeAssignment({ p1: 2, p2: 1 }))).toBe(true);
    expect(custom(makeAssignment({ p1: 1 }, 1))).toBe(true);
    expect(custom(makeAssignment({ p1: 2, p2: 1 }), 'p3')).toBe(false);
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
    const receipt = makeReceipt('r1', [makeItem('i1', '9.00', equalShares(['p3', 'p1', 'p2']))]);

    const [item] = items([receipt]);

    expect(item.claimants.map((person) => person.firstName)).toEqual(['Eugene', 'Mei', 'Arjun']);
    expect(item.claimants[2]).toMatchObject({ name: 'Arjun', colorIndex: 2 });
    expect(item.isLeft).toBe(false);
    expect(item.share).toMatchObject({ label: '1/3', amountLabel: '$3.00' });
  });

  it('offers to split evenly or take the item alone only when that would change it', () => {
    const receipt = makeReceipt('r1', [
      makeItem('even', '9.00', equalShares(['p1', 'p2', 'p3'])),
      makeItem('weighted', '9.00', makeAssignment({ p1: 2, p2: 1, p3: 1 })),
      makeItem('solo', '9.00', equalShares(['p1'])),
      makeItem('half', '9.00', makeAssignment({ p1: 1 }, 1)),
    ]);

    const shares = Object.fromEntries(items([receipt]).map((item) => [item.id, item.share]));

    expect(shares.even).toMatchObject({ canSplitEvenly: false, canTakeAlone: true });
    expect(shares.weighted).toMatchObject({ canSplitEvenly: true, canTakeAlone: true });
    expect(shares.solo).toMatchObject({ canSplitEvenly: true, canTakeAlone: false });
    expect(shares.half).toMatchObject({ canSplitEvenly: true, canTakeAlone: true });
  });

  it('says how much of a half-claimed item is still left', () => {
    const receipt = makeReceipt('r1', [makeItem('i1', '6.00', makeAssignment({ p1: 1 }, 1))]);

    const [item] = items([receipt], 'p2');

    expect(item).toMatchObject({ leftLabel: '1/2 left', isLeft: true, share: null });
    expect(item.claimants.map((person) => person.id)).toEqual(['p1']);
  });

  it('ignores stale person ids on an assignment', () => {
    const receipt = makeReceipt('r1', [makeItem('i1', '6.00', equalShares(['p2', 'removed']))]);

    expect(items([receipt])[0].claimants.map((person) => person.id)).toEqual(['p2']);
  });

  it('prices items after their line discount in the receipt currency', () => {
    const discounted = { ...makeItem('i1', '10.00'), discountPercentInput: '10' };
    const receipt = makeReceipt('r1', [discounted], 'USD');

    expect(items([receipt])[0].priceLabel).toBe('US$9.00');
  });

  it('leaves out blank rows without a price and names untitled items', () => {
    const receipt = makeReceipt('r1', [
      makeItem('blank', ''),
      makeItem('i1', '4.00', NOBODY, '  '),
    ]);

    const result = items([receipt]);

    expect(result.map((item) => item.id)).toEqual(['i1']);
    expect(result[0].name).toBe('Untitled item');
  });

  it('lists every receipt as its own section and counts what is left', () => {
    const receipts = [
      makeReceipt('r1', [makeItem('a', '5.00', equalShares(['p1'])), makeItem('b', '6.00')]),
      makeReceipt('r2', [makeItem('c', '7.00'), makeItem('d', '2.00'), makeItem('blank', '')]),
    ];

    const result = view(receipts);

    expect(result.sections.map((section) => [section.receiptId, section.items.length])).toEqual([
      ['r1', 2],
      ['r2', 2],
    ]);
    expect(result.sections.map((section) => section.leftCount)).toEqual([1, 2]);
  });

  it('marks an item as taken only when other people have all of it', () => {
    const receipt = makeReceipt('r1', [
      makeItem('theirs', '5.00', equalShares(['p2', 'p3'])),
      makeItem('shared', '5.00', equalShares(['p1', 'p2'])),
      makeItem('open', '5.00'),
      makeItem('half', '5.00', makeAssignment({ p2: 1 }, 1)),
    ]);

    const taken = Object.fromEntries(items([receipt]).map((item) => [item.id, item.takenByOthers]));

    expect(taken).toEqual({ theirs: true, shared: false, open: false, half: false });
  });

  it('labels a share of the whole item as All', () => {
    const receipt = makeReceipt('r1', [makeItem('i1', '4.00', equalShares(['p1']))]);

    expect(items([receipt])[0].share?.label).toBe('All');
  });
});

describe('listItemsLeft', () => {
  it('lists what the last person would split, with any part already taken', () => {
    const receipts = [
      makeReceipt('r1', [
        makeItem('a', '5.00', NOBODY, 'Carrot Cake'),
        makeItem('b', '18.00', makeAssignment({ p1: 1 }, 1), 'Sambal Stingray'),
        makeItem('c', '5.00', equalShares(['p1'])),
        makeItem('blank', ''),
      ]),
      makeReceipt('r2', [makeItem('d', '3.00', equalShares(['removed']), 'Kopi')], 'USD'),
    ];

    expect(listItemsLeft(receipts, people)).toEqual([
      {
        id: 'a',
        receiptName: 'Receipt r1',
        name: 'Carrot Cake',
        priceLabel: '$5.00',
        leftLabel: null,
      },
      {
        id: 'b',
        receiptName: 'Receipt r1',
        name: 'Sambal Stingray',
        priceLabel: '$18.00',
        leftLabel: '1/2 left',
      },
      { id: 'd', receiptName: 'Receipt r2', name: 'Kopi', priceLabel: 'US$3.00', leftLabel: null },
    ]);
  });
});

function itemView(receipts: Receipt[]) {
  return resolveItemClaimView({
    receipts,
    people,
    totalByPersonCents: { p1: 1234, p2: 500 },
    totalsCurrency: 'SGD',
  });
}

function amountOf(chip: ClaimChip): string | null {
  return chip.selected ? chip.amountLabel : null;
}

function itemClaims(receipts: Receipt[]) {
  return itemView(receipts).sections.flatMap((section) => section.items);
}

describe('resolveItemClaimView', () => {
  it('has every person with their running total and nobody active', () => {
    const result = itemView([makeReceipt('r1', [makeItem('i1', '8.50')])]);

    expect(result.mode).toBe('item');
    expect(result.people.map((person) => [person.firstName, person.totalCents])).toEqual([
      ['Eugene', 1234],
      ['Mei', 500],
      ['Arjun', 0],
    ]);
    expect(result.people.map((person) => person.isActive)).toEqual([false, false, false]);
  });

  it('gives each person on an item a pressed chip with what they pay for it', () => {
    const receipt = makeReceipt('r1', [makeItem('i1', '10.00', equalShares(['p3', 'p1']))]);

    const [item] = itemClaims([receipt]);

    expect(item.chips.map((chip) => [chip.person.firstName, amountOf(chip)])).toEqual([
      ['Eugene', '$5.00'],
      ['Mei', null],
      ['Arjun', '$5.00'],
    ]);
    expect(item).toMatchObject({
      priceLabel: '$10.00',
      isLeft: false,
      isSplitEvenly: false,
      hasUnevenShares: false,
    });
  });

  it('presses Everyone only when every person has an equal share', () => {
    const everyone = (assignment: ItemAssignment) =>
      itemClaims([makeReceipt('r1', [makeItem('i1', '9.00', assignment)])])[0].isSplitEvenly;

    expect(everyone(equalShares(['p1', 'p2', 'p3']))).toBe(true);
    expect(everyone(makeAssignment({ p1: 2, p2: 1, p3: 1 }))).toBe(false);
    expect(everyone(equalShares(['p1', 'p2']))).toBe(false);
    expect(everyone(NOBODY)).toBe(false);
  });

  it('flags uneven share weights but not an item that is only partly taken', () => {
    const uneven = (assignment: ItemAssignment) =>
      itemClaims([makeReceipt('r1', [makeItem('i1', '9.00', assignment)])])[0].hasUnevenShares;

    expect(uneven(makeAssignment({ p1: 2, p2: 1 }))).toBe(true);
    expect(uneven(makeAssignment({ p1: 1 }, 1))).toBe(false);
    expect(uneven(equalShares(['p1', 'p2']))).toBe(false);
  });

  it('prices a weighted item by share and says what is still left of a half-taken one', () => {
    const receipt = makeReceipt('r1', [
      makeItem('weighted', '9.00', makeAssignment({ p1: 2, p2: 1 })),
      makeItem('half', '6.00', makeAssignment({ p2: 1 }, 1)),
    ]);

    const [weighted, half] = itemClaims([receipt]);

    expect(weighted.chips.map(amountOf)).toEqual(['$6.00', '$3.00', null]);
    expect(half).toMatchObject({ isLeft: true, leftLabel: '1/2 left' });
    expect(half.chips.map(amountOf)).toEqual([null, '$3.00', null]);
  });

  it('leaves out blank rows without a price', () => {
    const receipt = makeReceipt('r1', [makeItem('blank', ''), makeItem('i1', '4.00')]);

    expect(itemClaims([receipt]).map((item) => item.id)).toEqual(['i1']);
  });
});

describe('resolveNextOpenItemId', () => {
  const receipts = [
    makeReceipt('r1', [
      makeItem('a', '1.00'),
      makeItem('b', '1.00', equalShares(['p1'])),
      makeItem('c', '1.00'),
    ]),
    makeReceipt('r2', [makeItem('d', '1.00', equalShares(['p2'])), makeItem('e', '1.00')]),
  ];
  const sections = () => itemView(receipts).sections;

  it('opens the first item left on the page when nothing is open', () => {
    expect(resolveNextOpenItemId(sections(), null)).toBe('a');
  });

  it('opens the first item when every item already has someone', () => {
    const allAssigned = itemView([
      makeReceipt('r1', [
        makeItem('a', '1.00', equalShares(['p1'])),
        makeItem('b', '1.00', equalShares(['p2'])),
      ]),
    ]).sections;

    expect(resolveNextOpenItemId(allAssigned, null)).toBe('a');
  });

  it('opens nothing when there are no items', () => {
    expect(resolveNextOpenItemId(itemView([makeReceipt('r1', [])]).sections, null)).toBeNull();
  });

  it('skips assigned items and carries on into the next receipt', () => {
    expect(resolveNextOpenItemId(sections(), 'a')).toBe('c');
    expect(resolveNextOpenItemId(sections(), 'c')).toBe('e');
  });

  it('wraps round to the start after the last item', () => {
    expect(resolveNextOpenItemId(sections(), 'e')).toBe('a');
  });

  it('gives null when no other item is left', () => {
    const onlyOne = itemView([
      makeReceipt('r1', [makeItem('a', '1.00', equalShares(['p1'])), makeItem('b', '1.00')]),
    ]).sections;

    expect(resolveNextOpenItemId(onlyOne, 'b')).toBeNull();
    expect(resolveNextOpenItemId(onlyOne, 'a')).toBe('b');
  });
});

describe('countItems', () => {
  it('counts every priced item across receipts', () => {
    const receipts = [
      makeReceipt('r1', [makeItem('a', '1.00', equalShares(['p1'])), makeItem('b', '')]),
      makeReceipt('r2', [makeItem('c', '2.00')]),
    ];

    expect(countItems(receipts)).toBe(2);
  });
});

describe('countItemsLeft', () => {
  it('counts unassigned, stale and half-claimed items as left', () => {
    const receipts = [
      makeReceipt('r1', [
        makeItem('a', '5.00', equalShares(['removed'])),
        makeItem('b', '5.00', makeAssignment({ p1: 1 }, 1)),
        makeItem('c', '5.00', equalShares(['p1'])),
      ]),
    ];

    expect(countItemsLeft(receipts, people)).toBe(2);
  });
});

describe('resolveClaimContinue', () => {
  it('moves on to the next person by first name', () => {
    expect(resolveClaimContinue('person', people, 'p2', 4)).toEqual({
      kind: 'next-person',
      personId: 'p3',
      label: 'Next: Arjun',
    });
  });

  it('offers to split leftovers evenly on the last person', () => {
    expect(resolveClaimContinue('person', people, 'p3', 2)).toEqual({
      kind: 'split-leftovers',
      label: 'Split 2 left evenly',
    });
  });

  it('never moves to a person when assigning by item', () => {
    expect(resolveClaimContinue('item', people, 'p1', 3)).toEqual({
      kind: 'split-leftovers',
      label: 'Split 3 left evenly',
    });
    expect(resolveClaimContinue('item', people, 'p1', 0)).toEqual({
      kind: 'see-summary',
      label: 'See summary',
    });
  });

  it('goes to the summary on the last person once everything is claimed', () => {
    expect(resolveClaimContinue('person', people, 'p3', 0)).toEqual({
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
