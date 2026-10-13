import { describe, expect, it } from 'vitest';
import type {
  BreakdownRow,
  PersonBreakdown,
  PersonBreakdownBody,
  ReceiptBreakdownSection,
} from '@shared/types/summaryBreakdown';
import { layoutCard } from './personBreakdownLayout';

/** Every character is 10px wide, so a label's width is easy to reason about. */
const ctx = {
  font: '',
  measureText: (text: string) => ({ width: text.length * 10 }),
} as unknown as CanvasRenderingContext2D;

function card(body: PersonBreakdownBody, overrides: Partial<PersonBreakdown> = {}) {
  return layoutCard(ctx, {
    person: { id: 'alice', name: 'Alice' },
    colorIndex: 0,
    headerLabel: 'Total',
    totalCents: 1200,
    currency: 'SGD',
    body,
    ...overrides,
  });
}

function item(label: string, amountCents: number | null = 1200): BreakdownRow {
  return { kind: 'item', id: label, label, amountCents, currency: 'SGD' };
}

const gst: BreakdownRow = {
  kind: 'charge',
  charge: 'gst',
  label: 'GST / Tax (9%)',
  amountCents: 108,
  sign: 'plus',
  currency: 'SGD',
};

function section(rows: BreakdownRow[], overrides: Partial<ReceiptBreakdownSection> = {}) {
  return {
    id: 'lunch',
    title: 'Lunch',
    totalCents: 1200,
    currency: 'SGD' as const,
    rows,
    ...overrides,
  };
}

function sections(...list: ReceiptBreakdownSection[]): PersonBreakdownBody {
  return { kind: 'sections', sections: list };
}

function onlySections(layout: ReturnType<typeof card>) {
  if (layout.body.kind !== 'sections') throw new Error(`The card shows ${layout.body.kind}`);
  return layout.body.sections;
}

describe('layoutCard', () => {
  it('gives a card with nothing under its header just the header and padding', () => {
    const empty = card({ kind: 'receiptTotals', totals: [] });

    expect(empty.bodyTop).toBe(112);
    expect(empty.body.height).toBe(0);
    expect(empty.height).toBe(140);
  });

  it('adds a line to the header for a converted total', () => {
    const converted = card(
      { kind: 'receiptTotals', totals: [] },
      {
        conversion: {
          amountCents: 1620,
          rate: 1.35,
          fromCurrency: 'USD',
          toCurrency: 'SGD',
          showRate: true,
        },
      },
    );

    expect(converted.bodyTop).toBe(142);
  });

  it('stacks one row per receipt total', () => {
    const totals = card({
      kind: 'receiptTotals',
      totals: [
        { id: 'a', label: 'Lunch', totalCents: 700, currency: 'SGD' },
        { id: 'b', label: 'Drinks', totalCents: 500, currency: 'SGD' },
      ],
    });

    if (totals.body.kind !== 'receiptTotals') throw new Error('Expected receipt totals');
    expect(totals.body.totals.map((total) => [total.item.label, total.y])).toEqual([
      ['Lunch', 0],
      ['Drinks', 40],
    ]);
    expect(totals.body.height).toBe(80);
  });

  it('gives the empty message one row', () => {
    expect(card({ kind: 'empty', message: 'No items assigned.' }).body.height).toBe(40);
  });

  it('places a section’s rows in order under its heading, each at its own height', () => {
    const [lunch] = onlySections(card(sections(section([item('Laksa'), { kind: 'rule' }, gst]))));

    expect(lunch.item.ruleY).toBe(50);
    expect(lunch.item.rows.map((row) => [row.item.kind, row.y, row.height])).toEqual([
      ['item', 68, 38],
      ['rule', 106, 14],
      ['charge', 120, 34],
    ]);
    expect(lunch.item.height).toBe(174);
  });

  it('pushes the rows down by a line for each conversion line', () => {
    const conversion = {
      amountCents: 1620,
      rate: 1.35,
      fromCurrency: 'USD' as const,
      toCurrency: 'SGD' as const,
      showRate: true,
    };
    const [both] = onlySections(card(sections(section([item('Laksa')], { conversion }))));
    const [amountOnly] = onlySections(
      card(sections(section([item('Laksa')], { conversion: { ...conversion, showRate: false } }))),
    );

    expect(both.item.conversionLines.map((line) => [line.item, line.y])).toEqual([
      ['≈ $16.20', 50],
      ['1 SGD = 0.74074 USD', 76],
    ]);
    expect(both.item.rows[0].y).toBe(120);
    expect(amountOnly.item.conversionLines).toHaveLength(1);
    expect(amountOnly.item.rows[0].y).toBe(94);
  });

  it('makes an item row taller when its name wraps onto a second line', () => {
    const long = 'Seasonal vegetables with black garlic and toasted sesame on a hot stone plate';
    const [lunch] = onlySections(card(sections(section([item(long), item('Tea')]))));

    expect(lunch.item.rows.map((row) => [row.y, row.height])).toEqual([
      [68, 66],
      [134, 38],
    ]);
  });

  it('gives a section with nothing in it one row for the message', () => {
    const [lunch] = onlySections(
      card(sections(section([{ kind: 'empty', message: 'No items assigned.' }]))),
    );

    expect(lunch.item.rows.map((row) => row.height)).toEqual([40]);
  });

  it('leaves a gap between sections', () => {
    const layout = card(sections(section([item('Laksa')]), section([item('Tea')], { id: 'tea' })));

    expect(onlySections(layout).map((placed) => [placed.y, placed.height])).toEqual([
      [0, 126],
      [138, 126],
    ]);
    expect(layout.body.height).toBe(264);
  });

  it('makes room under the body for the PayNow code', () => {
    const body = sections(section([item('Laksa')]));

    expect(card(body, { qrDataUrl: 'data:image/png;base64,qr' }).height - card(body).height).toBe(
      264,
    );
  });
});
