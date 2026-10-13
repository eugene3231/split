import { describe, expect, it } from 'vitest';
import type {
  OverviewRow,
  SummaryOverview,
} from '@features/split-workspace/summary/overview/types';
import { measureOverviewImage } from './overviewLayout';

const item: OverviewRow = {
  kind: 'item',
  id: 'laksa',
  name: 'Laksa',
  priceCents: 1000,
  currency: 'SGD',
  sharesByPerson: { p0: 1000 },
};

const gst: OverviewRow = {
  kind: 'charge',
  charge: 'gst',
  label: 'GST / Tax',
  sign: 'plus',
  totalCents: 90,
  currency: 'SGD',
  sharesByPerson: {},
};

const heading: OverviewRow = { kind: 'heading', title: 'Dinner' };

const sectionTotal: OverviewRow = {
  kind: 'sectionTotal',
  label: 'Dinner total',
  totalCents: 1090,
  currency: 'SGD',
  totalByPersonCents: { p0: 1090 },
};

function overview(sections: OverviewRow[][], peopleCount = 2): SummaryOverview {
  return {
    people: Array.from({ length: peopleCount }, (_, index) => ({
      id: `p${index}`,
      name: `Person ${index}`,
    })),
    sections: sections.map((rows, index) => ({ id: `r${index}`, rows })),
    currency: 'SGD',
    totalCents: 1090 * sections.length,
    totalByPersonCents: {},
  };
}

describe('measureOverviewImage', () => {
  it('lists every section’s rows in order, one after the next', () => {
    const { rows } = measureOverviewImage(
      overview([
        [heading, item, gst, sectionTotal],
        [heading, item, sectionTotal],
      ]),
    );

    expect(rows.map((row) => row.kind)).toEqual([
      'heading',
      'item',
      'charge',
      'sectionTotal',
      'heading',
      'item',
      'sectionTotal',
    ]);
  });

  it('gives each kind of row its own height', () => {
    const empty = measureOverviewImage(overview([[]])).height;
    const heightOf = (row: OverviewRow) => measureOverviewImage(overview([[row]])).height - empty;

    expect([heading, item, gst, sectionTotal].map(heightOf)).toEqual([52, 76, 68, 76]);
  });

  it('widens with each person once they no longer fit the narrowest image', () => {
    expect(measureOverviewImage(overview([[item]], 2)).width).toBe(1200);
    expect(measureOverviewImage(overview([[item]], 12)).width).toBe(2816);
  });
});
