import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SummaryOverview } from '@shared/types/summaryOverview';
import { OverviewTable } from './OverviewTable';

const alice = { id: 'alice', name: 'Alice Tan' };
const bob = { id: 'bob', name: 'Bob' };

function overview(overrides: Partial<SummaryOverview> = {}): SummaryOverview {
  return {
    people: [alice, bob],
    sections: [
      {
        id: 'dinner',
        title: 'Dinner',
        currency: 'SGD',
        itemRows: [
          {
            id: 'laksa',
            name: 'Laksa',
            priceCents: 1000,
            currency: 'SGD',
            sharesByPerson: { alice: 600, bob: 400 },
            unassigned: false,
          },
          {
            id: 'toast',
            name: 'Kaya toast',
            priceCents: 300,
            currency: 'SGD',
            sharesByPerson: {},
            unassigned: true,
          },
        ],
        chargeRows: [
          {
            kind: 'discount',
            label: 'Discount (10%)',
            sign: 'minus',
            totalCents: 100,
            sharesByPerson: { alice: 60, bob: 40 },
          },
        ],
        totalCents: 900,
        totalByPersonCents: { alice: 540, bob: 360 },
      },
    ],
    currency: 'SGD',
    totalCents: 900,
    totalByPersonCents: { alice: 540, bob: 360 },
    unassignedItemCount: 1,
    ...overrides,
  };
}

describe('OverviewTable', () => {
  it('flags unassigned items with no one’s share against them', () => {
    render(<OverviewTable overview={overview()} />);

    expect(screen.getByText('1 unassigned')).toBeInTheDocument();
    const row = screen.getByRole('row', { name: /Kaya toast/ });
    expect(row).toHaveTextContent('$3.00 · nobody yet');
    expect(within(row).queryByTitle(/Kaya toast:/)).toBeNull();
  });

  it('labels each share with the person and amount', () => {
    render(<OverviewTable overview={overview()} />);

    expect(screen.getByTitle('Alice Tan, Laksa: $6.00')).toHaveTextContent('$6.00');
    expect(screen.getByRole('columnheader', { name: 'Alice Tan' })).toBeInTheDocument();
    expect(screen.getByTitle('Alice Tan')).toHaveTextContent('Alice');
  });

  it('shows discount shares as deductions', () => {
    render(<OverviewTable overview={overview()} />);

    expect(screen.getByRole('row', { name: /Discount/ })).toHaveTextContent('−$0.60−$0.40');
  });

  it('adds receipt headings and per-receipt totals only when several receipts are combined', () => {
    const single = overview();
    const { rerender } = render(<OverviewTable overview={single} />);
    expect(screen.queryByRole('rowheader', { name: /Dinner total/ })).toBeNull();

    const drinks = { ...single.sections[0], id: 'drinks', title: 'Drinks' };
    rerender(<OverviewTable overview={overview({ sections: [single.sections[0], drinks] })} />);

    expect(screen.getByRole('rowheader', { name: 'Drinks' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: /Dinner total/ })).toHaveTextContent('$9.00');
  });

  it('keeps the pinned people row lined up when the table scrolls sideways', () => {
    render(<OverviewTable overview={overview()} />);
    const table = screen.getByTestId('overview-table-scroll');
    const pinnedRow = screen.getByTitle('Alice Tan').closest('[aria-hidden="true"]');

    table.scrollLeft = 40;
    fireEvent.scroll(table);

    expect(pinnedRow?.scrollLeft).toBe(40);
  });
});
