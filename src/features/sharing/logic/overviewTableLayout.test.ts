import { describe, expect, it } from 'vitest';
import type { OverviewReceiptSection, SummaryOverview } from '@shared/types/summaryOverview';
import { buildOverviewImageRows, measureOverviewImage } from './overviewTableLayout';

function section(id: string): OverviewReceiptSection {
  return {
    id,
    title: id,
    currency: 'SGD',
    itemRows: [
      {
        id: `${id}-item`,
        name: 'Laksa',
        priceCents: 1000,
        currency: 'SGD',
        sharesByPerson: { alice: 1000 },
        unassigned: false,
      },
    ],
    chargeRows: [
      { kind: 'gst', label: 'GST / Tax', sign: 'plus', totalCents: 90, sharesByPerson: {} },
    ],
    totalCents: 1090,
    totalByPersonCents: { alice: 1090 },
  };
}

function overview(sections: OverviewReceiptSection[], peopleCount = 2): SummaryOverview {
  return {
    people: Array.from({ length: peopleCount }, (_, index) => ({
      id: `p${index}`,
      name: `Person ${index}`,
    })),
    sections,
    currency: 'SGD',
    totalCents: 1090 * sections.length,
    totalByPersonCents: {},
    unassignedItemCount: 0,
  };
}

describe('buildOverviewImageRows', () => {
  it('lists one receipt as items then charges, with no heading or subtotal', () => {
    expect(buildOverviewImageRows(overview([section('dinner')])).map((row) => row.kind)).toEqual([
      'item',
      'charge',
    ]);
  });

  it('heads and totals each receipt when there are several', () => {
    const rows = buildOverviewImageRows(overview([section('dinner'), section('drinks')]));
    expect(rows.map((row) => row.kind)).toEqual([
      'heading',
      'item',
      'charge',
      'sectionTotal',
      'heading',
      'item',
      'charge',
      'sectionTotal',
    ]);
  });
});

describe('measureOverviewImage', () => {
  it('widens with each person and grows with each row', () => {
    const small = measureOverviewImage(overview([section('dinner')], 2));
    const wide = measureOverviewImage(overview([section('dinner')], 12));
    const tall = measureOverviewImage(overview([section('dinner'), section('drinks')], 2));

    expect(wide.width).toBeGreaterThan(small.width);
    expect(tall.height).toBeGreaterThan(small.height);
  });
});
