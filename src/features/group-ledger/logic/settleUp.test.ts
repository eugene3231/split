import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Cents, MemberId, Transfer } from '@features/group-ledger/domain/types';
import { asMemberId } from './ids';
import { settleUp } from './settleUp';
import { ana, ben, cat, dan } from './testHelpers';

const eve = asMemberId('eve');

function afterPaying(balances: Record<MemberId, Cents>, transfers: Transfer[]) {
  const left = { ...balances };
  for (const { from, to, cents } of transfers) {
    left[from] += cents;
    left[to] -= cents;
  }
  return left;
}

function fewestByBruteForce(cents: number[]): number {
  const first = cents.findIndex((value) => value !== 0);
  if (first === -1) return 0;
  let fewest = Infinity;
  for (let other = first + 1; other < cents.length; other++) {
    if (cents[other] * cents[first] >= 0) continue;
    const next = [...cents];
    next[other] += next[first];
    next[first] = 0;
    fewest = Math.min(fewest, 1 + fewestByBruteForce(next));
  }
  return fewest;
}

const zeroSum = (minLength: number, maxLength: number) =>
  fc
    .array(fc.integer({ min: -5, max: 5 }), { minLength, maxLength })
    .map((values): Record<MemberId, Cents> => {
      const all = [...values, -values.reduce((total, value) => total + value, 0)];
      return Object.fromEntries(
        all.map((cents, index) => [`m${String(index).padStart(2, '0')}`, cents]),
      );
    });

describe('settleUp', () => {
  it('needs nothing when everyone is square', () => {
    expect(settleUp({})).toEqual([]);
    expect(settleUp({ [ana]: 0, [ben]: 0 })).toEqual([]);
  });

  it('has the one who owes pay the one who is owed', () => {
    expect(settleUp({ [ana]: 1800, [ben]: -1800 })).toEqual([
      { from: 'ben', to: 'ana', cents: 1800 },
    ]);
  });

  it('has two debtors each pay the one creditor, the larger debt first', () => {
    expect(settleUp({ [ana]: 1500, [ben]: -500, [cat]: -1000 })).toEqual([
      { from: 'cat', to: 'ana', cents: 1000 },
      { from: 'ben', to: 'ana', cents: 500 },
    ]);
  });

  it('finds the pairs that square each other, where largest-first alone would need a fourth payment', () => {
    const transfers = settleUp({ [ana]: 600, [ben]: 500, [cat]: -500, [dan]: -400, [eve]: -200 });

    expect(transfers).toEqual([
      { from: 'dan', to: 'ana', cents: 400 },
      { from: 'eve', to: 'ana', cents: 200 },
      { from: 'cat', to: 'ben', cents: 500 },
    ]);
  });

  it('breaks a tie by member id, however the balances are listed', () => {
    const expected = [
      { from: 'cat', to: 'ana', cents: 500 },
      { from: 'dan', to: 'ben', cents: 500 },
    ];

    expect(settleUp({ [ana]: 500, [ben]: 500, [cat]: -500, [dan]: -500 })).toEqual(expected);
    expect(settleUp({ [dan]: -500, [ben]: 500, [cat]: -500, [ana]: 500 })).toEqual(expected);
  });

  it('still clears a group too large to search exactly, pairing equal debts and credits', () => {
    const balances: Record<MemberId, Cents> = Object.fromEntries(
      Array.from({ length: 14 }, (_, index) => [
        `m${String(index).padStart(2, '0')}`,
        index % 2 === 0 ? 100 * (index + 1) : -100 * index,
      ]),
    );

    const transfers = settleUp(balances);

    expect(Object.values(afterPaying(balances, transfers)).every((cents) => cents === 0)).toBe(
      true,
    );
    expect(transfers).toHaveLength(7);
  });
});

describe('settleUp properties', () => {
  it('clears every balance with payments from debtors to creditors, never more than members less one', () => {
    fc.assert(
      fc.property(zeroSum(0, 17), (balances) => {
        const transfers = settleUp(balances);
        const open = Object.values(balances).filter((cents) => cents !== 0).length;

        expect(Object.values(afterPaying(balances, transfers)).every((cents) => cents === 0)).toBe(
          true,
        );
        expect(transfers.length).toBeLessThanOrEqual(Math.max(open - 1, 0));
        for (const { from, to, cents } of transfers) {
          expect(cents).toBeGreaterThan(0);
          expect(balances[from]).toBeLessThan(0);
          expect(balances[to]).toBeGreaterThan(0);
        }
      }),
    );
  });

  it('uses exactly as few payments as trying every possibility finds', () => {
    fc.assert(
      fc.property(zeroSum(0, 7), (balances) => {
        expect(settleUp(balances)).toHaveLength(fewestByBruteForce(Object.values(balances)));
      }),
    );
  });

  it('lists the same payments whatever order the balances come in', () => {
    fc.assert(
      fc.property(
        zeroSum(0, 9).chain((balances) =>
          fc.tuple(
            fc.constant(balances),
            fc.shuffledSubarray(Object.entries(balances), {
              minLength: Object.keys(balances).length,
            }),
          ),
        ),
        ([balances, reordered]) => {
          expect(settleUp(Object.fromEntries(reordered))).toEqual(settleUp(balances));
        },
      ),
    );
  });
});
