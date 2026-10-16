import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Person } from '@shared/types';
import { useSplits } from '@features/split-workspace/hooks/useSplits';
import { buildSplitShareText } from '@features/split-workspace/summary/shareSplit';
import { equalShares } from '@features/split-workspace/logic/assignment';
import { makeItem, makeReceipt, percentCharge, resetAllStores, seedStore } from './testHelpers';

beforeEach(resetAllStores);

const alice = { id: 'alice', name: 'Alice' };
const bob = { id: 'bob', name: 'Bob' };

function solo(person: Person, amountInput: string) {
  return makeItem({ amountInput, assignment: equalShares([person.id]) });
}

describe('Export and sharing integration', () => {
  it('shares one receipt as its total and each person’s share with charges', () => {
    seedStore(
      [alice, bob],
      [
        makeReceipt({
          items: [solo(alice, '10.00'), solo(bob, '20.00')],
          serviceCharge: percentCharge('10'),
        }),
      ],
    );
    const [active] = renderHook(() => useSplits()).result.current.receiptSplits;

    expect(
      buildSplitShareText({
        people: [alice, bob],
        receiptName: 'Dinner',
        split: active.split,
        currency: 'SGD',
      }),
    ).toBe('Dinner total: $33.00\n\nAlice: $11.00\nBob: $22.00');
  });

  it('shares a mixed-currency trip in SGD', () => {
    const local = makeReceipt({ items: [solo(alice, '10.00')] });
    const abroad = makeReceipt({ items: [solo(bob, '10.00')], currency: 'USD' });
    seedStore([alice, bob], [local, abroad], { exchangeRates: { SGD: 1, USD: 1.35 } });
    const { consolidated } = renderHook(() => useSplits()).result.current;

    expect(
      buildSplitShareText({
        people: [alice, bob],
        receiptName: 'Split',
        split: consolidated,
        currency: 'SGD',
      }),
    ).toBe('Split total: $23.50\n\nAlice: $10.00\nBob: $13.50');
  });
});
