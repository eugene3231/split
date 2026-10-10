import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    render(<SummaryStep onAddReceipt={vi.fn()} onResetSplit={vi.fn()} />);

    fireEvent.click(screen.getByTestId('export-copy-text-btn'));

    await waitFor(() =>
      expect(screen.getByTestId('export-copy-text-btn')).toHaveTextContent('Shared!'),
    );
    expect(screen.queryByText('Copied!')).toBeNull();
  });

  it('shows selectable current split text when browser copy is unavailable', async () => {
    seedDinner();
    vi.stubGlobal('navigator', {});
    render(<SummaryStep onAddReceipt={vi.fn()} onResetSplit={vi.fn()} />);

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

    render(<SummaryStep onAddReceipt={vi.fn()} onResetSplit={vi.fn()} />);

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

    render(<SummaryStep onAddReceipt={vi.fn()} onResetSplit={vi.fn()} />);

    expect(screen.queryByText('Reconciliation Discrepancy')).toBeNull();
    fireEvent.click(screen.getByTestId('summary-tab-receipt-1'));
    expect(screen.getByText(/The sum of individual shares/)).toHaveTextContent(
      'US$1.00 off from the receipt total.',
    );
  });

  it.each([
    [['IDR', 'IDR'], true],
    [['IDR', 'USD'], false],
  ])(
    'totals %j receipts as billed only when they share one currency',
    (currencies, totalsAsBilled) => {
      const alice = makePerson('Alice');
      const assignment = { mode: 'single' as const, personId: alice.id, personIds: [alice.id] };
      const receipts = currencies.map((currency, index) =>
        makeReceipt({
          id: `r${index}`,
          currency,
          items: [makeItem({ amountInput: '50000', assignment })],
        }),
      );
      seedStore([alice], receipts, { exchangeRates: { SGD: 1, IDR: 0.00008, USD: 1.35 } });

      render(<SummaryStep onAddReceipt={vi.fn()} onResetSplit={vi.fn()} />);

      const grandTotal = screen.getByText('Grand Total').closest('.rounded-3xl');
      expect(grandTotal?.textContent?.includes('Rp')).toBe(totalsAsBilled);
      expect(screen.queryByText(/Totals in SGD/) === null).toBe(totalsAsBilled);
    },
  );

  it('offers Reset split once, alongside the export actions', () => {
    seedDinner();
    render(<SummaryStep onAddReceipt={vi.fn()} onResetSplit={vi.fn()} />);

    expect(screen.getAllByRole('button', { name: 'Reset split' })).toHaveLength(1);
  });

  it('renders one page heading for every screen size', () => {
    seedDinner();
    render(<SummaryStep onAddReceipt={vi.fn()} onResetSplit={vi.fn()} />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('adds a receipt from the receipt tabs row', () => {
    seedDinner();
    const onAddReceipt = vi.fn();
    render(<SummaryStep onAddReceipt={onAddReceipt} onResetSplit={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add receipt' }));

    expect(onAddReceipt).toHaveBeenCalledOnce();
  });

  it('switches between the By person cards and the read-only overview table', () => {
    const alice = makePerson('Alice');
    const bob = makePerson('Bob');
    seedStore(
      [alice, bob],
      [
        makeReceipt({
          name: 'Dinner',
          items: [
            makeItem({
              name: 'Laksa',
              amountInput: '10.00',
              assignment: { mode: 'equal', personId: '', personIds: [alice.id, bob.id] },
            }),
            makeItem({
              name: 'Kopi',
              amountInput: '2.20',
              assignment: { mode: 'equal', personId: '', personIds: [bob.id] },
            }),
          ],
        }),
      ],
    );
    render(<SummaryStep onAddReceipt={vi.fn()} onResetSplit={vi.fn()} />);

    const byPerson = screen.getByRole('button', { name: 'By person' });
    const overviewToggle = screen.getByRole('button', { name: 'Overview' });
    expect(byPerson).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('region', { name: 'Who had what' })).toBeNull();

    fireEvent.click(overviewToggle);

    expect(overviewToggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('summary-show-details-btn')).toBeNull();
    const table = within(screen.getByRole('region', { name: 'Who had what' }));
    expect(table.getByRole('rowheader', { name: /Laksa/ })).toHaveTextContent('$10.00');
    expect(table.getByRole('rowheader', { name: /Owes/ })).toHaveTextContent('of $12.20');
    expect(table.getByRole('row', { name: /Owes/ })).toHaveTextContent('$5.00$7.20');
    expect(table.queryByRole('textbox')).toBeNull();

    fireEvent.click(byPerson);

    expect(screen.queryByRole('region', { name: 'Who had what' })).toBeNull();
    expect(screen.getByTestId('summary-show-details-btn')).toBeInTheDocument();
  });
});
