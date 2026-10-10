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
  resolveClaimContinue,
  resolveClaimProgress,
  resolveClaimView,
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
    currency,
    exchangeRateOverride: null,
  };
}

function view(receipts: Receipt[], activePersonId = 'p1', activeReceiptId = receipts[0].id) {
  return resolveClaimView({
    receipts,
    activeReceiptId,
    people,
    activePersonId,
    totalByPersonCents: { p1: 1234, p2: 500 },
    totalsCurrency: 'SGD',
  });
}

describe('resolveClaimView', () => {
  it('marks only the active person and labels running totals in the totals currency', () => {
    const result = view([makeReceipt('r1', [makeItem('i1', '8.50')])], 'p2');

    expect(result.activePerson).toMatchObject({ id: 'p2', firstName: 'Mei', totalLabel: '$5.00' });
    expect(result.people.map((person) => person.isActive)).toEqual([false, true, false]);
    expect(result.people[0]).toMatchObject({ firstName: 'Eugene', totalLabel: '$12.34' });
    expect(result.people[2].totalLabel).toBe('$0.00');
  });

  it('falls back to the first person when the active person no longer exists', () => {
    const result = view([makeReceipt('r1', [makeItem('i1', '8.50')])], 'gone');

    expect(result.activePerson?.id).toBe('p1');
  });

  it('labels an unclaimed item as nobody yet', () => {
    const [item] = view([makeReceipt('r1', [makeItem('i1', '8.50')])]).items;

    expect(item).toMatchObject({
      priceLabel: '$8.50',
      claimedByActive: false,
      claimants: [],
      shareLabel: 'Nobody yet',
      canAdjustSplit: false,
    });
  });

  it('says "Just you" for the active person and names anyone else', () => {
    const receipt = makeReceipt('r1', [
      makeItem('mine', '8.50', { personIds: ['p1'] }),
      makeItem('theirs', '9.80', { personIds: ['p3'] }),
    ]);

    const [mine, theirs] = view([receipt]).items;

    expect(mine).toMatchObject({ claimedByActive: true, shareLabel: 'Just you' });
    expect(theirs).toMatchObject({ claimedByActive: false, shareLabel: 'Just Arjun' });
  });

  it('describes an equal split with each share and lists claimants in people order', () => {
    const receipt = makeReceipt('r1', [makeItem('i1', '8.50', { personIds: ['p3', 'p1', 'p2'] })]);

    const [item] = view([receipt]).items;

    expect(item.shareLabel).toBe('Shared 3 ways · $2.83 each');
    expect(item.claimants.map((person) => person.id)).toEqual(['p1', 'p2', 'p3']);
    expect(item.canAdjustSplit).toBe(true);
  });

  it('treats identical custom weights as an equal split', () => {
    const receipt = makeReceipt('r1', [
      makeItem('i1', '10.00', {
        personIds: ['p1', 'p2'],
        weights: { p1: 50, p2: 50 },
        weightsInputMode: 'percent',
      }),
    ]);

    expect(view([receipt]).items[0].shareLabel).toBe('Shared 2 ways · $5.00 each');
  });

  it('shows what the active person pays on a custom split, and only "Custom split" to others', () => {
    const receipt = makeReceipt('r1', [
      makeItem('i1', '12.00', { personIds: ['p1', 'p2'], weights: { p1: 2, p2: 1 } }),
    ]);

    expect(view([receipt], 'p1').items[0].shareLabel).toBe('Custom split · you pay $8.00');
    expect(view([receipt], 'p3').items[0].shareLabel).toBe('Custom split');
  });

  it('ignores stale person ids on an assignment', () => {
    const receipt = makeReceipt('r1', [makeItem('i1', '6.00', { personIds: ['p2', 'removed'] })]);

    const [item] = view([receipt]).items;

    expect(item.claimants.map((person) => person.id)).toEqual(['p2']);
    expect(item.shareLabel).toBe('Just Mei');
  });

  it('prices items after their line discount in the receipt currency', () => {
    const discounted = { ...makeItem('i1', '10.00'), discountPercentInput: '10' };
    const receipt = makeReceipt('r1', [discounted], 'USD');

    expect(view([receipt]).items[0].priceLabel).toBe('US$9.00');
  });

  it('leaves out blank rows without a price and names untitled items', () => {
    const receipt = makeReceipt('r1', [makeItem('blank', ''), makeItem('i1', '4.00', {}, '  ')]);

    const result = view([receipt]);

    expect(result.items.map((item) => item.id)).toEqual(['i1']);
    expect(result.items[0].name).toBe('Untitled item');
  });

  it('shows the active receipt items but counts progress across every receipt', () => {
    const receipts = [
      makeReceipt('r1', [makeItem('a', '5.00', { personIds: ['p1'] }), makeItem('b', '6.00')]),
      makeReceipt('r2', [makeItem('c', '7.00'), makeItem('blank', '')]),
    ];

    const result = view(receipts, 'p1', 'r2');

    expect(result.items.map((item) => item.id)).toEqual(['c']);
    expect(result.progress).toEqual({ claimed: 1, total: 3, remaining: 2 });
  });
});

describe('resolveClaimProgress', () => {
  it('counts an item claimed only by a removed person as unclaimed', () => {
    const receipts = [makeReceipt('r1', [makeItem('a', '5.00', { personIds: ['removed'] })])];

    expect(resolveClaimProgress(receipts, people)).toEqual({ claimed: 0, total: 1, remaining: 1 });
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
