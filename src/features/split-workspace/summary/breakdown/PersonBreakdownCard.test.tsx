import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type {
  BreakdownRow,
  PersonBreakdown,
  PersonBreakdownBody,
} from '@features/split-workspace/summary/breakdown/types';
import { PersonBreakdownCard } from './PersonBreakdownCard';

function breakdown(body: PersonBreakdownBody): PersonBreakdown {
  return {
    person: { id: 'alice', name: 'Alice' },
    colorIndex: 0,
    headerLabel: 'Total',
    totalCents: 1200,
    currency: 'SGD',
    qrDataUrl: 'data:image/png;base64,qr',
    body,
  };
}

function lunch(rows: BreakdownRow[]): PersonBreakdownBody {
  return {
    kind: 'sections',
    sections: [{ id: 'lunch', title: 'Lunch', totalCents: 1200, currency: 'SGD', rows }],
  };
}

const laksa: BreakdownRow = {
  kind: 'item',
  id: 'laksa',
  label: 'Laksa',
  amountCents: 1200,
  currency: 'SGD',
};

function follows(later: Element, earlier: Element) {
  return Boolean(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe('PersonBreakdownCard', () => {
  it('ends with the PayNow QR, after the items, as the PNG does', () => {
    render(<PersonBreakdownCard breakdown={breakdown(lunch([laksa]))} />);

    expect(follows(screen.getByAltText('PayNow QR for Alice'), screen.getByText('Laksa'))).toBe(
      true,
    );
  });

  it('ends with the PayNow QR when only receipt totals show', () => {
    const totals: PersonBreakdownBody = {
      kind: 'receiptTotals',
      totals: [{ id: 'lunch', label: 'Lunch', totalCents: 1200, currency: 'SGD' }],
    };
    render(<PersonBreakdownCard breakdown={breakdown(totals)} />);

    expect(follows(screen.getByAltText('PayNow QR for Alice'), screen.getByText('Lunch'))).toBe(
      true,
    );
  });

  it('shows a section’s rows in the order the breakdown lists them', () => {
    const rows: BreakdownRow[] = [
      laksa,
      { kind: 'item', id: 'tea', label: 'Tea', amountCents: null, currency: 'SGD' },
      { kind: 'rule' },
      {
        kind: 'charge',
        charge: 'discount',
        label: 'Discount',
        amountCents: 100,
        sign: 'minus',
        currency: 'SGD',
      },
      {
        kind: 'charge',
        charge: 'gst',
        label: 'GST / Tax (9%)',
        amountCents: 99,
        sign: 'plus',
        currency: 'SGD',
      },
    ];
    render(<PersonBreakdownCard breakdown={breakdown(lunch(rows))} />);

    const shown = ['Laksa', 'Tea', 'Discount', 'GST / Tax (9%)'].map((label) =>
      screen.getByText(label),
    );
    shown.slice(1).forEach((row, index) => expect(follows(row, shown[index])).toBe(true));
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('−$1.00')).toBeInTheDocument();
    expect(screen.getByText('+$0.99')).toBeInTheDocument();
  });

  it('says so when the person has nothing', () => {
    render(
      <PersonBreakdownCard
        breakdown={breakdown({ kind: 'empty', message: 'No items assigned.' })}
      />,
    );

    expect(screen.getByText('No items assigned.')).toBeInTheDocument();
  });
});
