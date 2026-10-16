import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CHARGE_KINDS } from '@shared/types';
import type { ChargeState, EditableItem, PersonSplit, SplitResult } from '@shared/types';
import { CURRENCY_CODES } from '@shared/constants';
import { makeAssignment } from '@features/split-workspace/logic/assignment';
import { convertSplitResult } from '@features/split-workspace/logic/exchangeRates';
import { allocate, allocateCents } from './allocation';
import { signedCharge } from './amounts';
import { resolveDiscountedAmountCents } from './pricing';
import { computeSplit, type ReceiptPricing } from './split';

const PEOPLE = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'].map((id) => ({ id, name: id }));

const money = (maxCents: number) =>
  fc.integer({ min: 0, max: maxCents }).map((cents) => (cents / 100).toFixed(2));

const chargeArb = (maxPercent: number, maxAmountCents: number): fc.Arbitrary<ChargeState> =>
  fc.record({
    enabled: fc.boolean(),
    mode: fc.constantFrom('percent' as const, 'amount' as const),
    percentInput: fc.integer({ min: 0, max: maxPercent }).map(String),
    amountInput: money(maxAmountCents),
    detectedConfidence: fc.constant(null),
    detectedSource: fc.constant(null),
  });

const itemArb: fc.Arbitrary<Omit<EditableItem, 'id'>> = fc.record({
  name: fc.constant('Item'),
  amountInput: money(50_000),
  discountPercentInput: fc.oneof(fc.constant(''), fc.integer({ min: 0, max: 100 }).map(String)),
  assignment: fc
    .tuple(
      fc.dictionary(
        fc.constantFrom(...PEOPLE.map((person) => person.id)),
        fc.integer({ min: 0, max: 10 }),
      ),
      fc.integer({ min: 0, max: 5 }),
    )
    .map(([shares, unassignedShare]) => makeAssignment(shares, unassignedShare)),
});

const receiptArb: fc.Arbitrary<ReceiptPricing> = fc.record({
  items: fc
    .array(itemArb, { minLength: 1, maxLength: 8 })
    .map((items) => items.map((item, index) => ({ ...item, id: `i${index}` }))),
  discount: chargeArb(100, 20_000),
  serviceCharge: chargeArb(20, 5_000),
  gst: chargeArb(10, 5_000),
  tip: chargeArb(25, 5_000),
  roundingInput: fc.oneof(
    fc.constant(''),
    fc.integer({ min: -99, max: 99 }).map((cents) => (cents / 100).toFixed(2)),
  ),
});

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

function personTotal({ subtotalCents, chargeCents }: PersonSplit) {
  return CHARGE_KINDS.reduce(
    (total, kind) => total + signedCharge(kind, chargeCents[kind]),
    subtotalCents,
  );
}

/** Compares as numbers, so the -0 a converted zero charge comes out as matches 0. */
function expectSumsTo(values: number[], total: number) {
  expect(sum(values) - total).toBe(0);
}

/** Every column adds up across people, and every person's row adds up to their total. */
function expectBalanced({ totals, byPerson }: SplitResult) {
  const people = Object.values(byPerson);
  expectSumsTo(
    people.map((person) => person.subtotalCents),
    totals.subtotalCents,
  );
  for (const kind of CHARGE_KINDS) {
    expectSumsTo(
      people.map((person) => person.chargeCents[kind]),
      totals.chargeCents[kind],
    );
  }
  expectSumsTo(
    people.map((person) => person.totalCents),
    totals.totalCents,
  );
  for (const person of people) {
    expectSumsTo([personTotal(person)], person.totalCents);
    expectSumsTo(
      person.lines.map((line) => line.amountCents ?? 0),
      person.subtotalCents,
    );
    expect(person.chargeCents.discount).toBeLessThanOrEqual(person.subtotalCents);
  }
}

describe('allocation invariants', () => {
  it('hands out every cent, each part within a cent of its exact share', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1_000_000, max: 1_000_000 }),
        fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 1, maxLength: 12 }),
        (total, weights) => {
          const parts = allocate(total, weights);
          const weightSum = sum(weights);

          expect(sum(parts)).toBe(total);
          parts.forEach((part, i) => {
            const exact =
              weightSum === 0 ? total / weights.length : (total * weights[i]) / weightSum;
            expect(Math.abs(part - exact)).toBeLessThan(1);
          });
        },
      ),
    );
  });

  it('gives each person the same cents whatever order people are listed in', () => {
    const peopleArb = fc
      .uniqueArray(fc.string({ minLength: 1, maxLength: 4 }), { minLength: 1, maxLength: 8 })
      .chain((ids) =>
        fc.tuple(
          fc.constant(ids),
          fc.shuffledSubarray(ids, { minLength: ids.length }),
          fc.array(fc.integer({ min: 0, max: 10 }), {
            minLength: ids.length,
            maxLength: ids.length,
          }),
        ),
      );
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000 }),
        peopleArb,
        (total, [ids, shuffled, list]) => {
          const weights = Object.fromEntries(ids.map((id, i) => [id, list[i]]));
          expect(allocateCents(total, shuffled, weights)).toEqual(
            allocateCents(total, ids, weights),
          );
        },
      ),
    );
  });
});

describe('split invariants', () => {
  it('adds every person and every charge up to the receipt', () => {
    fc.assert(fc.property(receiptArb, (receipt) => expectBalanced(computeSplit(receipt, PEOPLE))));
  });

  it('charges nothing to a person on no item, once anyone is on one', () => {
    fc.assert(
      fc.property(receiptArb, (receipt) => {
        const people = Object.values(computeSplit(receipt, PEOPLE).byPerson);
        const hasItem = (person: PersonSplit) =>
          person.lines.some((line) => line.amountCents !== null);
        // With nobody on anything, a fixed charge is shared evenly instead.
        fc.pre(people.some(hasItem));
        for (const person of people.filter((person) => !hasItem(person))) {
          expect(person.totalCents).toBe(0);
        }
      }),
    );
  });

  it('charges a fully claimed item at its discounted price, and a half-claimed one at less', () => {
    fc.assert(
      fc.property(receiptArb, (receipt) => {
        const lines = Object.values(computeSplit(receipt, PEOPLE).byPerson).flatMap(
          (person) => person.lines,
        );
        for (const item of receipt.items) {
          const priceCents = resolveDiscountedAmountCents(item) ?? 0;
          const charged = sum(
            lines.filter((line) => line.itemId === item.id).map((line) => line.amountCents ?? 0),
          );
          if (Object.keys(item.assignment.shares).length === 0) expect(charged).toBe(0);
          else if (item.assignment.unassignedShare === 0) expect(charged).toBe(priceCents);
          else expect(charged).toBeLessThanOrEqual(priceCents);
        }
      }),
    );
  });

  it('stays balanced after converting to another currency', () => {
    fc.assert(
      fc.property(
        receiptArb,
        fc.constantFrom(...CURRENCY_CODES.filter((code) => code !== 'SGD')),
        fc.double({ min: 0.00005, max: 5, noNaN: true }),
        (receipt, currency, rate) => {
          expectBalanced(
            convertSplitResult(computeSplit(receipt, PEOPLE), currency, 'SGD', {}, rate),
          );
        },
      ),
    );
  });
});
