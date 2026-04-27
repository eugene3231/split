import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Person, SplitResult } from '@shared/types';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { GrandTotalCard } from './GrandTotalCard';

const people: Person[] = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
];

const split: SplitResult = {
  lineItemsByPerson: {},
  involvedCountByPerson: {},
  subtotalByPersonCents: { p1: 1200, p2: 800 },
  discountByPersonCents: { p1: 0, p2: 0 },
  serviceByPersonCents: { p1: 0, p2: 0 },
  gstByPersonCents: { p1: 0, p2: 0 },
  totalByPersonCents: { p1: 1200, p2: 800 },
  subtotalCents: 2000,
  discountCents: 0,
  serviceChargeCents: 0,
  gstCents: 0,
  grandTotalCents: 2000,
  unassignedItemCount: 0,
};

function renderCard() {
  return render(
    <GrandTotalCard
      grandTotal={2000}
      displayCurrency="SGD"
      currentReceipt={null}
      people={people}
      onRenameReceipt={vi.fn()}
      split={split}
    />,
  );
}

describe('GrandTotalCard', () => {
  beforeEach(() => {
    useReceiptStore.setState({ payerMobile: '' });
  });

  it('renders the compact grand total card without expandable details', () => {
    renderCard();

    expect(screen.getByTestId('grand-total-label')).toBeInTheDocument();
    expect(screen.getByText('$20.00')).toBeInTheDocument();
    expect(screen.getByTestId('grand-total-people-count')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show details/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('PayNow Number')).not.toBeInTheDocument();
  });

  it('renders exchange-rate context below the hero amount when provided', () => {
    render(
      <GrandTotalCard
        grandTotal={2000}
        displayCurrency="MYR"
        currentReceipt={null}
        people={people}
        onRenameReceipt={vi.fn()}
        split={split}
        exchangeRateText="1 SGD = 3.10662 MYR"
      />,
    );

    expect(screen.getByTestId('grand-total-exchange-rate')).toBeInTheDocument();
  });
});
