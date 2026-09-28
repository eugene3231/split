import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SummaryStep } from './SummaryStep';
import {
  makeItem,
  makePerson,
  makeReceipt,
  resetAllStores,
  seedStore,
} from '../../../../../tests/integration/testHelpers';

beforeEach(resetAllStores);

describe('SummaryStep', () => {
  it('shows a static Grand Total label on the Total tab instead of an editable receipt name', () => {
    const alice = makePerson('Alice');
    const receipt1 = makeReceipt({
      id: 'r1',
      name: 'Dinner',
      items: [
        makeItem({
          amountInput: '10.00',
          assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
        }),
      ],
    });
    const receipt2 = makeReceipt({
      id: 'r2',
      name: 'Drinks',
      items: [
        makeItem({
          amountInput: '5.00',
          assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
        }),
      ],
    });

    seedStore([alice], [receipt1, receipt2], { activeReceiptId: 'r1' });

    render(<SummaryStep onAddReceipt={vi.fn()} />);

    // Defaults to the consolidated "total" tab when there are multiple receipts.
    const grandTotalLabel = screen.getByText('Grand Total');
    expect(grandTotalLabel.closest('[contenteditable="true"]')).toBeNull();
  });

  it('shows the selected foreign receipt discrepancy in its native currency', () => {
    const alice = makePerson('Alice');
    const assignment = { mode: 'single' as const, personId: alice.id, personIds: [alice.id] };
    const receipt1 = makeReceipt({
      id: 'r1',
      items: [makeItem({ amountInput: '10.00', assignment })],
      receiptTotalInput: '8.00',
    });
    const receipt2 = makeReceipt({
      id: 'r2',
      currency: 'USD',
      items: [makeItem({ amountInput: '20.00', assignment })],
      receiptTotalInput: '19.00',
    });
    seedStore([alice], [receipt1, receipt2], {
      activeReceiptId: 'r1',
      exchangeRates: { SGD: 1, USD: 1.35 },
    });

    render(<SummaryStep onAddReceipt={vi.fn()} />);

    expect(screen.queryByText('Reconciliation Discrepancy')).toBeNull();
    fireEvent.click(screen.getByTestId('summary-tab-receipt-1'));
    expect(screen.getByText(/The sum of individual shares/)).toHaveTextContent(
      'US$1.00 off from the receipt total.',
    );
  });
});
