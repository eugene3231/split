import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PersonBreakdown } from '@shared/types/summaryBreakdown';
import { PersonBreakdownCard } from './PersonBreakdownCard';

const breakdown: PersonBreakdown = {
  person: { id: 'alice', name: 'Alice' },
  colorIndex: 0,
  headerLabel: 'Total',
  totalCents: 1200,
  currency: 'SGD',
  qrDataUrl: 'data:image/png;base64,qr',
  collapsedReceiptTotals: [{ id: 'lunch', label: 'Lunch', totalCents: 1200, currency: 'SGD' }],
  sections: [
    {
      id: 'lunch',
      title: 'Lunch',
      totalCents: 1200,
      currency: 'SGD',
      itemRows: [
        { id: 'laksa', label: 'Laksa', amountCents: 1200, involved: true, currency: 'SGD' },
      ],
      chargeRows: [],
    },
  ],
};

function follows(later: Element, earlier: Element) {
  return Boolean(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe('PersonBreakdownCard', () => {
  it('ends with the PayNow QR, after the items, as the PNG does', () => {
    render(<PersonBreakdownCard breakdown={breakdown} showDetails />);

    expect(follows(screen.getByAltText('PayNow QR for Alice'), screen.getByText('Laksa'))).toBe(
      true,
    );
  });

  it('ends with the PayNow QR when only receipt totals show', () => {
    render(<PersonBreakdownCard breakdown={breakdown} />);

    expect(follows(screen.getByAltText('PayNow QR for Alice'), screen.getByText('Lunch'))).toBe(
      true,
    );
  });
});
