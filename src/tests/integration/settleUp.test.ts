import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSettleUpTrip } from '@features/settle-up/hooks/useSettleUpTrip';
import { resolveBalances, resolveTransfers } from '@features/settle-up/logic/settleUp';
import { makeItem, makePerson, makeReceipt, resetAllStores, seedStore } from './testHelpers';

beforeEach(resetAllStores);

describe('Settle-up trip integration', () => {
  it('falls back to the sample trip while the workspace has nothing to settle', () => {
    seedStore([makePerson('Alice')], [makeReceipt({})]);

    const { result } = renderHook(() => useSettleUpTrip());

    expect(result.current.isSample).toBe(true);
  });

  it('settles a two-receipt trip in base currency from workspace state', () => {
    const alice = makePerson('Alice');
    const bob = makePerson('Bob');
    const dinner = makeReceipt({
      id: 'dinner',
      items: [
        makeItem({
          amountInput: '40.00',
          assignment: { mode: 'equal', personId: '', personIds: [alice.id, bob.id] },
        }),
      ],
    });
    const snacks = makeReceipt({
      id: 'snacks',
      currency: 'MYR',
      items: [
        makeItem({
          amountInput: '30.00',
          assignment: { mode: 'equal', personId: '', personIds: [bob.id] },
        }),
      ],
    });
    seedStore([alice, bob], [dinner, snacks], { exchangeRates: { SGD: 1, MYR: 0.3 } });

    const { result } = renderHook(() => useSettleUpTrip());
    const { people, receipts, isSample } = result.current;
    const transfers = resolveTransfers(
      resolveBalances(people, receipts, { dinner: alice.id, snacks: alice.id }),
    );

    expect(isSample).toBe(false);
    expect(receipts.map((r) => r.owedByPersonCents[bob.id])).toEqual([2000, 900]);
    expect(transfers).toEqual([{ fromPersonId: bob.id, toPersonId: alice.id, amountCents: 2900 }]);
  });
});
