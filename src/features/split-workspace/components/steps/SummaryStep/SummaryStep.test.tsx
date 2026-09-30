import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SummaryStep } from './SummaryStep';
import {
  makeItem,
  makePerson,
  makeReceipt,
  resetAllStores,
  seedStore,
} from '../../../../../tests/integration/testHelpers';

beforeEach(resetAllStores);
afterEach(() => vi.unstubAllGlobals());

function seedDinner() {
  const alice = makePerson('Alice');
  seedStore(
    [alice],
    [
      makeReceipt({
        name: 'Dinner',
        items: [
          makeItem({
            amountInput: '10.00',
            assignment: { mode: 'equal', personId: '', personIds: [alice.id] },
          }),
        ],
      }),
    ],
  );
}

describe('SummaryStep', () => {
  it('reports the successful native share as shared', async () => {
    seedDinner();
    vi.stubGlobal('navigator', { share: vi.fn().mockResolvedValue(undefined) });
    render(<SummaryStep onAddReceipt={vi.fn()} />);

    fireEvent.click(screen.getByTestId('export-copy-text-btn'));

    await waitFor(() =>
      expect(screen.getByTestId('export-copy-text-btn')).toHaveTextContent('Shared!'),
    );
    expect(screen.queryByText('Copied!')).toBeNull();
  });

  it('shows selectable current split text when browser copy is unavailable', async () => {
    seedDinner();
    vi.stubGlobal('navigator', {});
    render(<SummaryStep onAddReceipt={vi.fn()} />);

    fireEvent.click(screen.getByTestId('export-copy-text-btn'));

    const field = await screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'Split text' });
    expect(field).toHaveValue('Dinner total: $10.00\n\nAlice: $10.00');
    fireEvent.click(screen.getByRole('button', { name: 'Select text' }));
    expect(field).toHaveFocus();
    expect(field.selectionEnd).toBe(field.value.length);
  });

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
