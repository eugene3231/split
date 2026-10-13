import { describe, expect, it } from 'vitest';
import { deriveSplits } from '@features/split-workspace/logic/split/deriveSplits';
import type { NonEmptyArray } from '@features/split-workspace/logic/nonEmpty';
import type { ChargeState, EditableItem, Person, Receipt } from '@shared/types';
import { resolveSummaryBreakdown } from './summaryBreakdown';
import { resolveSummaryOverview } from './summaryOverview';
import { resolveSummaryView } from './summaryView';
import { equalShares } from '@features/split-workspace/logic/assignment';

const offCharge: ChargeState = {
  enabled: false,
  mode: 'percent',
  amountInput: '',
  percentInput: '',
  detectedConfidence: null,
  detectedSource: null,
};

function percent(percentInput: string): ChargeState {
  return { ...offCharge, enabled: true, percentInput };
}

const alice: Person = { id: 'alice', name: 'Alice' };
const bob: Person = { id: 'bob', name: 'Bob' };
const cara: Person = { id: 'cara', name: 'Cara' };
const people = [alice, bob, cara];

function item(id: string, amountInput: string, personIds: string[]): EditableItem {
  return {
    id,
    name: id,
    amountInput,
    discountPercentInput: '',
    assignment: equalShares(personIds),
  };
}

function receipt(overrides: Partial<Receipt> & Pick<Receipt, 'id' | 'items'>): Receipt {
  return {
    name: overrides.id,
    discount: offCharge,
    serviceCharge: offCharge,
    gst: offCharge,
    receiptTotalInput: '',
    roundingInput: '',
    currency: 'SGD',
    exchangeRateOverride: null,
    ...overrides,
  };
}

function resolve(
  receipts: NonEmptyArray<Receipt>,
  activeTab: string,
  exchangeRates = {},
  showBase = false,
) {
  const view = resolveSummaryView({
    ...deriveSplits(people, receipts, exchangeRates),
    exchangeRates,
    activeTab,
    showBaseCurrency: showBase,
  });
  return {
    overview: resolveSummaryOverview({ people, view }),
    breakdown: resolveSummaryBreakdown({ people, view }),
  };
}

const dinner = receipt({
  id: 'dinner',
  serviceCharge: percent('10'),
  gst: percent('9'),
  items: [
    item('laksa', '10.00', ['alice', 'bob', 'cara']),
    item('rice', '8.50', ['bob']),
    item('fries', '12.00', ['alice', 'cara']),
  ],
});

describe('resolveSummaryOverview', () => {
  it('lists rounding last, with the same per-person shares as each card', () => {
    const { overview, breakdown } = resolve([{ ...dinner, roundingInput: '0.05' }], 'dinner');

    const rounding = overview.sections[0].chargeRows.at(-1);
    expect(rounding).toMatchObject({ kind: 'rounding', label: 'Rounding', totalCents: 5 });
    expect(rounding?.sharesByPerson).toEqual({ alice: 2, bob: 2, cara: 1 });
    expect(
      breakdown.personBreakdowns.map((person) => {
        if (person.body.kind !== 'sections') return null;
        const rounding = person.body.sections[0].rows.find(
          (row) => row.kind === 'charge' && row.charge === 'rounding',
        );
        return rounding?.kind === 'charge' ? rounding.amountCents : null;
      }),
    ).toEqual([2, 2, 1]);
  });

  it('splits each item into shares that add up to its price', () => {
    const { overview } = resolve([dinner], 'dinner');

    const [laksa, rice, fries] = overview.sections[0].itemRows;
    expect(laksa.priceCents).toBe(1000);
    expect(laksa.sharesByPerson).toEqual({ alice: 334, bob: 333, cara: 333 });
    expect(rice.sharesByPerson).toEqual({ bob: 850 });
    expect(fries.priceCents).toBe(1200);
    expect(fries.sharesByPerson).toEqual({ alice: 600, cara: 600 });
  });

  it('adds a row per charge with each person’s share of it', () => {
    const { overview } = resolve([dinner], 'dinner');

    const rows = overview.sections[0].chargeRows;
    expect(rows.map((row) => [row.kind, row.label, row.totalCents])).toEqual([
      ['service', 'Service Charge (10%)', 305],
      ['gst', 'GST / Tax (9%)', 302],
    ]);
    const service = rows[0];
    expect(Object.values(service.sharesByPerson).reduce((sum, c) => sum + c, 0)).toBe(305);
  });

  it('shows the discount as a minus row and leaves out charges that are off', () => {
    const discounted = receipt({ ...dinner, discount: percent('10'), serviceCharge: offCharge });

    const { overview } = resolve([discounted], 'dinner');

    expect(overview.sections[0].chargeRows.map((row) => [row.kind, row.sign])).toEqual([
      ['discount', 'minus'],
      ['gst', 'plus'],
    ]);
  });

  it('matches every person’s total to the By person breakdown', () => {
    const { overview, breakdown } = resolve([dinner], 'dinner');

    for (const personBreakdown of breakdown.personBreakdowns) {
      expect(overview.totalByPersonCents[personBreakdown.person.id]).toBe(
        personBreakdown.totalCents,
      );
    }
    expect(overview.totalCents).toBe(3657);
    expect(overview.currency).toBe('SGD');
  });

  it('lists priced items in receipt order and leaves out free ones', () => {
    const lunch = receipt({
      id: 'lunch',
      items: [
        item('kopi', '2.20', ['bob']),
        item('free water', '0', ['alice']),
        item('teh', '2.00', ['alice']),
      ],
    });

    const { overview } = resolve([lunch], 'lunch');

    expect(overview.sections[0].itemRows.map((row) => [row.name, row.priceCents])).toEqual([
      ['kopi', 220],
      ['teh', 200],
    ]);
  });

  it('shows one section per receipt on the combined total, with the grand totals in SGD', () => {
    const drinks = receipt({
      id: 'drinks',
      name: 'Drinks',
      currency: 'MYR',
      exchangeRateOverride: 0.3,
      items: [item('beer', '20.00', ['alice', 'bob'])],
    });

    const { overview, breakdown } = resolve([dinner, drinks], 'total');

    expect(overview.sections.map((s) => [s.title, s.currency, s.totalCents])).toEqual([
      ['dinner', 'SGD', 3657],
      ['Drinks', 'MYR', 2000],
    ]);
    expect(overview.sections[1].totalByPersonCents).toEqual({ alice: 1000, bob: 1000, cara: 0 });
    expect(overview.currency).toBe('SGD');
    expect(overview.totalCents).toBe(3657 + 600);
    for (const personBreakdown of breakdown.personBreakdowns) {
      expect(overview.totalByPersonCents[personBreakdown.person.id]).toBe(
        personBreakdown.totalCents,
      );
    }
  });

  it('converts the combined sections to SGD when the summary shows base currency', () => {
    const drinks = receipt({
      id: 'drinks',
      currency: 'MYR',
      exchangeRateOverride: 0.3,
      items: [item('beer', '20.00', ['alice', 'bob'])],
    });

    const { overview } = resolve([dinner, drinks], 'total', {}, true);

    const [beer] = overview.sections[1].itemRows;
    expect(overview.sections[1].currency).toBe('SGD');
    expect(beer).toMatchObject({ priceCents: 600, currency: 'SGD' });
    expect(beer.sharesByPerson).toEqual({ alice: 300, bob: 300 });
  });
});
