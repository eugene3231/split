import { describe, expect, it } from 'vitest';
import type { ChargeState, Person, SplitLine, SplitResult } from '@shared/types';
import { resolveSummaryBreakdown } from './summaryBreakdown';
import { resolveSummaryView, type SummaryView } from './summaryView';
import { deriveSplits } from './split/deriveSplits';
import { makeItem, makeReceipt, makeSplit } from '../../../tests/integration/testHelpers';
import { equalShares } from '@features/split-workspace/logic/assignment';

function percentCharge(percentInput: string): ChargeState {
  return {
    enabled: true,
    mode: 'percent',
    amountInput: '',
    percentInput,
    detectedConfidence: null,
    detectedSource: null,
  };
}

const alice: Person = { id: 'alice', name: 'Alice' };
const bob: Person = { id: 'bob', name: 'Bob' };

function line(overrides: Partial<SplitLine> = {}): SplitLine {
  return {
    itemId: 'item-1',
    name: 'Noodles',
    amountCents: 1200,
    ...overrides,
  };
}

type PersonAmounts = Parameters<typeof makeSplit>[0][string];

/** Alice alone with a 12.00 bowl of noodles, unless told otherwise. */
function split(alice: PersonAmounts = {}): SplitResult {
  return makeSplit({ alice: { subtotalCents: 1200, lines: [line()], ...alice } });
}

describe('resolveSummaryBreakdown', () => {
  it.each(['r1', 'total'])(
    'uses allocated SGD cents for conversion copy on the %s tab',
    (activeTab) => {
      const people = [alice, bob];
      const receipt = makeReceipt({
        id: 'r1',
        currency: 'USD',
        items: people.map((person) =>
          makeItem({
            id: person.id,
            amountInput: '10.01',
            assignment: equalShares([person.id]),
          }),
        ),
      });
      const exchangeRates = { USD: 1.35 };
      const view = resolveSummaryView({
        ...deriveSplits(people, [receipt], exchangeRates),
        exchangeRates,
        activeTab,
        showBaseCurrency: false,
      });
      const breakdowns = resolveSummaryBreakdown({ people, view }).personBreakdowns;
      const conversions = breakdowns.map((person) =>
        activeTab === 'total' ? person.sections[0].conversion : person.conversion,
      );
      expect(view.baseSplit.byPerson).toMatchObject({
        alice: { totalCents: 1352 },
        bob: { totalCents: 1351 },
      });
      expect(conversions.map((conversion) => conversion?.amountCents)).toEqual([1352, 1351]);
    },
  );

  it('totals a one-currency trip as billed, with the SGD amount underneath', () => {
    const people = [alice, bob];
    const makeUsdReceipt = (id: string) =>
      makeReceipt({
        id,
        currency: 'USD',
        items: people.map((person) =>
          makeItem({
            id: `${id}-${person.id}`,
            amountInput: '10.00',
            assignment: equalShares([person.id]),
          }),
        ),
      });
    const exchangeRates = { USD: 1.35 };
    const view = resolveSummaryView({
      ...deriveSplits(people, [makeUsdReceipt('r1'), makeUsdReceipt('r2')], exchangeRates),
      exchangeRates,
      activeTab: 'total',
      showBaseCurrency: false,
    });
    const [aliceBreakdown] = resolveSummaryBreakdown({ people, view }).personBreakdowns;
    expect(aliceBreakdown.currency).toBe('USD');
    expect(aliceBreakdown.totalCents).toBe(2000);
    expect(aliceBreakdown.conversion).toEqual({
      amountCents: 2700,
      rate: 1.35,
      fromCurrency: 'USD',
      toCurrency: 'SGD',
      showRate: true,
    });
    expect(aliceBreakdown.sections.map((section) => section.conversion?.showRate)).toEqual([
      false,
      false,
    ]);
    expect(resolveSummaryBreakdown({ people, view }).exchangeRate).toEqual({
      rate: 1.35,
      fromCurrency: 'USD',
      toCurrency: 'SGD',
    });
  });

  it('leaves out the header rate when the receipts convert at different rates', () => {
    const view = resolveSummaryView({
      receiptSplits: [
        { receipt: makeReceipt({ id: 'r1', currency: 'USD' }), split: split() },
        {
          receipt: makeReceipt({ id: 'r2', currency: 'USD', exchangeRateOverride: 1.4 }),
          split: split(),
        },
      ],
      consolidated: split(),
      exchangeRates: { USD: 1.35 },
      activeTab: 'total',
      showBaseCurrency: false,
    });
    const [aliceBreakdown] = resolveSummaryBreakdown({ people: [alice], view }).personBreakdowns;
    expect(aliceBreakdown.currency).toBe('USD');
    expect(aliceBreakdown.conversion).toBeUndefined();
    expect(aliceBreakdown.sections.map((section) => section.conversion?.showRate)).toEqual([
      true,
      true,
    ]);
  });

  it('resolves single-receipt person rows and charge rows', () => {
    const view: SummaryView = {
      kind: 'receipt',
      receipt: {
        id: 'r1',
        name: 'Dinner',
        items: [],
        discount: percentCharge('5'),
        serviceCharge: percentCharge('10'),
        gst: percentCharge('9'),
        receiptTotalInput: '',
        roundingInput: '',
        currency: 'SGD',
        exchangeRateOverride: null,
      },
      displaySplit: split({ discount: 60, service: 120, gst: 108 }),
      displayCurrency: 'SGD',
      baseSplit: split(),
      nativeCurrency: 'SGD',
      isForeign: false,
      effectiveRate: null,
    };

    const breakdown = resolveSummaryBreakdown({
      people: [alice],
      view,
      qrDataUrls: { alice: 'data:image/png;base64,qr' },
    });

    expect(breakdown.totalLabel).toBe('Total');
    expect(breakdown.personBreakdowns).toHaveLength(1);
    const person = breakdown.personBreakdowns[0];
    expect(person.headerLabel).toBe('Total · this receipt');
    expect(person.totalCents).toBe(1368);
    expect(person.sections[0].totalCents).toBe(1368);
    expect(person.collapsedReceiptTotals).toEqual([
      { id: 'r1', label: 'Dinner', totalCents: 1368, currency: 'SGD' },
    ]);
    expect(person.qrDataUrl).toBe('data:image/png;base64,qr');
    expect(person.sections[0].itemRows).toMatchObject([
      { label: 'Noodles', amountCents: 1200, involved: true, currency: 'SGD' },
    ]);
    expect(person.sections[0].chargeRows).toEqual([
      {
        kind: 'discount',
        label: 'Discount (5%)',
        amountCents: 60,
        sign: 'minus',
        currency: 'SGD',
      },
      {
        kind: 'service',
        label: 'Service Charge (10%)',
        amountCents: 120,
        sign: 'plus',
        currency: 'SGD',
      },
      {
        kind: 'gst',
        label: 'GST / Tax (9%)',
        amountCents: 108,
        sign: 'plus',
        currency: 'SGD',
      },
    ]);
  });

  it('omits a second SGD conversion when a foreign receipt is displayed in SGD', () => {
    const view: SummaryView = {
      kind: 'receipt',
      receipt: makeReceipt({ currency: 'USD' }),
      displaySplit: split({ subtotalCents: 1620 }),
      displayCurrency: 'SGD',
      baseSplit: split({ subtotalCents: 1620 }),
      nativeCurrency: 'USD',
      isForeign: true,
      effectiveRate: 1.35,
    };

    const [person] = resolveSummaryBreakdown({ people: [alice], view }).personBreakdowns;

    expect(person.currency).toBe('SGD');
    expect(person.conversion).toBeUndefined();
  });

  it('includes receipt charges in expanded and collapsed totals', () => {
    const chargedSplit = split({ discount: 100, service: 200, gst: 90 });
    const view: SummaryView = {
      kind: 'total',
      displaySplit: chargedSplit,
      displayCurrency: 'SGD',
      baseSplit: chargedSplit,
      hasAnyForeign: false,
      billedCurrencies: ['SGD'],
      billedRate: null,
      receiptBreakdowns: [
        {
          receipt: makeReceipt({
            id: 'dinner',
            discount: percentCharge('8.33'),
            serviceCharge: percentCharge('16.67'),
            gst: percentCharge('7.5'),
          }),
          name: 'Dinner',
          split: chargedSplit,
          baseSplit: chargedSplit,
          currency: 'SGD',
        },
      ],
    };

    const [person] = resolveSummaryBreakdown({ people: [alice], view }).personBreakdowns;

    expect(person.totalCents).toBe(1390);
    expect(person.sections[0].totalCents).toBe(1390);
    expect(person.collapsedReceiptTotals[0].totalCents).toBe(1390);
    expect(person.sections[0].itemRows[0].amountCents).toBe(1200);
    expect(person.sections[0].chargeRows.map((row) => row.amountCents)).toEqual([100, 200, 90]);
  });

  it('resolves total-tab receipt sections and collapsed totals per person', () => {
    const ramenSplit = split({ lines: [line({ itemId: 'ramen', name: 'Ramen' })] });
    const teaSplit = split({
      subtotalCents: 300,
      lines: [line({ itemId: 'tea', name: 'Tea', amountCents: 300 })],
    });
    const view: SummaryView = {
      kind: 'total',
      displaySplit: split({ subtotalCents: 1800 }),
      displayCurrency: 'SGD',
      baseSplit: split(),
      hasAnyForeign: true,
      billedCurrencies: ['JPY'],
      billedRate: null,
      receiptBreakdowns: [
        {
          receipt: makeReceipt({ id: 'ramen-shop' }),
          name: 'Ramen Shop',
          split: ramenSplit,
          baseSplit: split({ subtotalCents: 11 }),
          currency: 'JPY',
          effectiveRate: 0.009,
        },
        {
          receipt: makeReceipt({ id: 'tea-stall' }),
          name: 'Tea Stall',
          split: teaSplit,
          baseSplit: teaSplit,
          currency: 'SGD',
          effectiveRate: undefined,
        },
      ],
    };

    const breakdown = resolveSummaryBreakdown({ people: [alice], view });
    const [person] = breakdown.personBreakdowns;

    expect(breakdown.totalLabel).toBe('Total · 2 receipts');
    expect(person.headerLabel).toBe('Total · 2 receipts');
    expect(person.collapsedReceiptTotals).toEqual([
      { id: 'ramen-shop', label: 'Ramen Shop', totalCents: 1200, currency: 'JPY' },
      { id: 'tea-stall', label: 'Tea Stall', totalCents: 300, currency: 'SGD' },
    ]);
    expect(person.sections.map((section) => section.title)).toEqual(['Ramen Shop', 'Tea Stall']);
    expect(person.sections[0].conversion).toEqual({
      amountCents: 11,
      rate: 0.009,
      fromCurrency: 'JPY',
      toCurrency: 'SGD',
      showRate: true,
    });
  });

  it('lists only the items a person had, and drops a receipt they had nothing on', () => {
    const dinner = split({
      lines: [
        line({ itemId: 'noodles', name: 'Noodles' }),
        line({ itemId: 'tea', name: 'Tea', amountCents: null }),
      ],
    });
    const drinks = split({
      subtotalCents: 0,
      lines: [line({ itemId: 'beer', name: 'Beer', amountCents: null })],
    });
    const view: SummaryView = {
      kind: 'total',
      displaySplit: dinner,
      displayCurrency: 'SGD',
      baseSplit: dinner,
      hasAnyForeign: false,
      billedCurrencies: ['SGD'],
      billedRate: null,
      receiptBreakdowns: [
        {
          receipt: makeReceipt({ id: 'dinner' }),
          name: 'Dinner',
          split: dinner,
          baseSplit: dinner,
          currency: 'SGD',
        },
        {
          receipt: makeReceipt({ id: 'drinks' }),
          name: 'Drinks',
          split: drinks,
          baseSplit: drinks,
          currency: 'SGD',
        },
      ],
    };

    const [person] = resolveSummaryBreakdown({ people: [alice], view }).personBreakdowns;

    expect(person.sections.map((section) => section.title)).toEqual(['Dinner']);
    expect(person.sections[0].itemRows.map((row) => row.label)).toEqual(['Noodles']);

    const [everything] = resolveSummaryBreakdown({
      people: [alice],
      view,
      showAllItems: true,
    }).personBreakdowns;
    expect(everything.sections.map((section) => section.title)).toEqual(['Dinner', 'Drinks']);
    expect(everything.sections[0].itemRows).toMatchObject([
      { label: 'Noodles', amountCents: 1200, involved: true },
      { label: 'Tea', amountCents: null, involved: false },
    ]);
  });

  it('marks a person with no assigned sections as empty', () => {
    const nothingForBob = makeSplit({ bob: {} });
    const view: SummaryView = {
      kind: 'total',
      displaySplit: nothingForBob,
      displayCurrency: 'SGD',
      baseSplit: nothingForBob,
      hasAnyForeign: false,
      billedCurrencies: ['SGD'],
      billedRate: null,
      receiptBreakdowns: [
        {
          receipt: makeReceipt({ id: 'dinner' }),
          name: 'Dinner',
          split: nothingForBob,
          baseSplit: nothingForBob,
          currency: 'SGD',
        },
      ],
    };

    const [person] = resolveSummaryBreakdown({ people: [bob], view }).personBreakdowns;

    expect(person.sections).toEqual([]);
    expect(person.emptyMessage).toBe('No items assigned.');
  });

  it('leaves out the receipt total for a person with nothing on a single receipt', () => {
    const nothingForBob = makeSplit({ bob: {} });
    const view: SummaryView = {
      kind: 'receipt',
      receipt: makeReceipt({}),
      displaySplit: nothingForBob,
      displayCurrency: 'SGD',
      baseSplit: nothingForBob,
      nativeCurrency: 'SGD',
      isForeign: false,
      effectiveRate: null,
    };

    const [person] = resolveSummaryBreakdown({ people: [bob], view }).personBreakdowns;

    expect(person.collapsedReceiptTotals).toEqual([]);
  });
});
