import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { makeAssignment } from '@features/split-workspace/logic/assignment';
import type { Change, StoredReceipt } from '@features/group-ledger/domain/types';
import { parseChange } from './codec';
import { asEntryId, asLocalDate, newUuid } from './ids';
import { postAmounts, postReceipt, postWeights, type ExpenseHeader } from './post';
import { ana, ben, cat, changeArb, makeMember } from './testHelpers';

const throughTheWire = (change: Change) => parseChange(JSON.parse(JSON.stringify(change)));

const header: ExpenseHeader = {
  id: asEntryId('e1'),
  title: 'Dinner',
  date: asLocalDate('2026-11-19'),
  currency: 'JPY',
  rate: 0.0091,
  payment: { payer: ana, others: { [ben]: 500 } },
};

const charge = (enabled: boolean, percentInput: string) => ({
  enabled,
  mode: 'percent' as const,
  amountInput: '',
  percentInput,
  detectedConfidence: null,
  detectedSource: null,
});

const receipt: StoredReceipt = {
  id: 'r1',
  name: 'Ichiran',
  items: [
    {
      id: 'i1',
      name: 'Ramen',
      amountInput: '1980',
      discountPercentInput: '',
      assignment: makeAssignment({ [ana]: 1, [ben]: 2 }, 0),
    },
  ],
  discount: charge(false, ''),
  serviceCharge: charge(true, '10'),
  gst: charge(true, '9'),
  receiptTotalInput: '',
  roundingInput: '',
  currency: 'JPY',
  exchangeRateOverride: null,
};

describe('changes read back the same after the wire', () => {
  it('reads back every expense the posting functions can build', () => {
    const built = [
      postWeights(header, 4200, { [ana]: 1, [ben]: 1, [cat]: 2 }),
      postAmounts(header, { [ana]: 1200, [cat]: 300 }),
      postReceipt(header, receipt, [makeMember(ana), makeMember(ben), makeMember(cat)]),
    ];

    for (const entry of built) {
      expect(entry).not.toBeNull();
      const change: Change = { kind: 'entry.put', entry: entry!, base: null };
      expect(throughTheWire(change)).toEqual(change);
    }
  });

  it('reads back any change the log can hold', () => {
    fc.assert(
      fc.property(changeArb(5), (change) => {
        expect(throughTheWire(change)).toEqual(change);
      }),
    );
  });

  it('makes lowercase version 4 UUIDs, which the server columns require', () => {
    expect(newUuid()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
