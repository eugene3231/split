import { describe, expect, it } from 'vitest';
import {
  centsByPerson,
  mapCharges,
  signedCharge,
  sumAmounts,
} from '@features/split-workspace/logic/split/amounts';
import { makeSplit } from '../../../../tests/integration/testHelpers';

describe('signedCharge', () => {
  it('counts a discount against the total and every other charge toward it', () => {
    expect(signedCharge('discount', 150)).toBe(-150);
    expect(signedCharge('service', 150)).toBe(150);
    expect(signedCharge('gst', 150)).toBe(150);
    expect(signedCharge('rounding', 150)).toBe(150);
  });
});

describe('mapCharges', () => {
  it('builds a value for each of the four charges', () => {
    expect(mapCharges((kind) => kind.length)).toEqual({
      discount: 8,
      service: 7,
      gst: 3,
      rounding: 8,
    });
  });
});

describe('sumAmounts', () => {
  it('adds the subtotal, each charge and the total', () => {
    const { byPerson } = makeSplit({
      alice: { subtotalCents: 1000, discount: 100, service: 90, gst: 89, rounding: 1 },
      bob: { subtotalCents: 500, discount: 50, service: 45, gst: 45 },
    });

    expect(sumAmounts(Object.values(byPerson))).toEqual({
      subtotalCents: 1500,
      chargeCents: { discount: 150, service: 135, gst: 134, rounding: 1 },
      totalCents: 1620,
    });
  });

  it('is zero for nothing', () => {
    expect(sumAmounts([])).toEqual({
      subtotalCents: 0,
      chargeCents: { discount: 0, service: 0, gst: 0, rounding: 0 },
      totalCents: 0,
    });
  });
});

describe('centsByPerson', () => {
  const split = makeSplit({
    alice: { subtotalCents: 1000, discount: 100, gst: 81 },
    bob: { subtotalCents: 500, discount: 50, gst: 41 },
  });

  it('picks out each person’s subtotal, total, or one of their charges', () => {
    expect(centsByPerson(split, 'subtotal')).toEqual({ alice: 1000, bob: 500 });
    expect(centsByPerson(split, 'total')).toEqual({ alice: 981, bob: 491 });
    expect(centsByPerson(split, 'discount')).toEqual({ alice: 100, bob: 50 });
    expect(centsByPerson(split, 'gst')).toEqual({ alice: 81, bob: 41 });
  });
});
