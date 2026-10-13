import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  OverviewReceiptSection,
  SummaryOverview,
} from '@features/split-workspace/summary/overview/types';
import { OverviewTable } from './OverviewTable';

const alice = { id: 'alice', name: 'Alice Tan' };
const bob = { id: 'bob', name: 'Bob' };

function dinner(severalReceipts = false): OverviewReceiptSection {
  return receipt('dinner', 'Dinner', severalReceipts);
}

function receipt(id: string, title: string, severalReceipts: boolean): OverviewReceiptSection {
  return {
    id,
    rows: [
      ...(severalReceipts ? [{ kind: 'heading' as const, title }] : []),
      {
        kind: 'item',
        id: 'laksa',
        name: 'Laksa',
        priceCents: 1000,
        currency: 'SGD',
        sharesByPerson: { alice: 600, bob: 400 },
      },
      {
        kind: 'charge',
        charge: 'discount',
        label: 'Discount (10%)',
        sign: 'minus',
        totalCents: 100,
        currency: 'SGD',
        sharesByPerson: { alice: 60, bob: 40 },
      },
      ...(severalReceipts
        ? [
            {
              kind: 'sectionTotal' as const,
              label: `${title} total`,
              totalCents: 900,
              currency: 'SGD' as const,
              totalByPersonCents: { alice: 540, bob: 360 },
            },
          ]
        : []),
    ],
  };
}

function overview(sections: OverviewReceiptSection[] = [dinner()]): SummaryOverview {
  return {
    people: [alice, bob],
    sections,
    currency: 'SGD',
    totalCents: 900,
    totalByPersonCents: { alice: 540, bob: 360 },
  };
}

const twoReceipts = () => overview([dinner(true), receipt('drinks', 'Drinks', true)]);

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

  it('shows the receipt headings and per-receipt totals the overview lists', () => {
    const { rerender } = render(<OverviewTable overview={overview()} />);
    expect(screen.queryByRole('rowheader', { name: /Dinner total/ })).toBeNull();

    rerender(<OverviewTable overview={twoReceipts()} />);

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
    render(<OverviewTable overview={twoReceipts()} />);
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
