import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
    ...overrides,
  };
}

afterEach(() => vi.restoreAllMocks());

describe('OverviewTable', () => {
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
    const pinnedRow = screen.getByTestId('overview-pinned-people');

    table.scrollLeft = 40;
    fireEvent.scroll(table);

    expect(pinnedRow?.scrollLeft).toBe(40);
  });

  it('pins the receipt being scrolled through under the people row', () => {
    const dinner = overview().sections[0];
    const drinks = { ...dinner, id: 'drinks', title: 'Drinks' };
    render(<OverviewTable overview={overview({ sections: [dinner, drinks] })} />);
    const tops: Record<string, number> = { Dinner: -200, Drinks: 400 };
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.dataset.testid === 'overview-pinned-people') return new DOMRect(0, 60, 300, 60);
      return new DOMRect(0, tops[this.dataset.sectionTitle ?? ''] ?? 0, 300, 30);
    });
    const pinned = () => screen.getByTestId('overview-pinned-people').parentElement;

    fireEvent.scroll(window);
    expect(pinned()).toHaveTextContent('Dinner');

    tops.Drinks = 100;
    fireEvent.scroll(window);
    expect(pinned()).toHaveTextContent('Drinks');

    tops.Dinner = 300;
    tops.Drinks = 600;
    fireEvent.scroll(window);
    expect(pinned()).not.toHaveTextContent('Dinner');
  });
});
