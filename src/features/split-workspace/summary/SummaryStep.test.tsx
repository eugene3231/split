import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SummaryStep } from './SummaryStep';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import {
  amountCharge,
  makeItem,
  makePerson,
  makeReceipt,
  resetAllStores,
  seedStore,
} from '../../../tests/integration/testHelpers';
import { equalShares } from '@features/split-workspace/logic/assignment';
import type { CurrencyCode } from '@shared/constants';

const { generatePaynowQrDataUrls } = vi.hoisted(() => ({ generatePaynowQrDataUrls: vi.fn() }));
vi.mock('@features/payments', async (importActual) => ({
  ...(await importActual<typeof import('@features/payments')>()),
  generatePaynowQrDataUrls,
}));
beforeEach(() => {
  resetAllStores();
  generatePaynowQrDataUrls.mockReset().mockResolvedValue({});
});
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
            assignment: equalShares([alice.id]),
          }),
        ],
      }),
    ],
  );
}

describe('SummaryStep', () => {
  it("lists each person's own items by default, everyone's on All items, and none on Totals", () => {
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
              assignment: equalShares([alice.id]),
            }),
            makeItem({
              name: 'Satay',
              amountInput: '6.00',
              assignment: equalShares([bob.id]),
            }),
          ],
        }),
      ],
    );
    render(<SummaryStep onAddReceipt={vi.fn()} onResetSplit={vi.fn()} />);

    expect(screen.getAllByText('Laksa')).toHaveLength(1);
    expect(screen.getAllByText('Satay')).toHaveLength(1);

    expect(screen.getByRole('radio', { name: 'Their items' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    fireEvent.click(screen.getByRole('radio', { name: 'All items' }));

    expect(screen.getAllByText('Laksa')).toHaveLength(2);
    expect(screen.getAllByText('Satay')).toHaveLength(2);

    fireEvent.click(screen.getByRole('radio', { name: 'Totals' }));

    expect(screen.queryByText('Laksa')).toBeNull();
    expect(screen.queryByText('Satay')).toBeNull();
  });

  it("shows each person's receipt amount on Totals when the split has one receipt", () => {
    const alice = makePerson('Alice');
    const bob = makePerson('Bob');
    seedStore(
      [alice, bob],
      [
        makeReceipt({
          name: 'Dinner',
          items: [
            makeItem({
              amountInput: '10.00',
              assignment: equalShares([alice.id]),
            }),
            makeItem({
              amountInput: '6.00',
              assignment: equalShares([bob.id]),
            }),
          ],
        }),
      ],
    );
    render(<SummaryStep onAddReceipt={vi.fn()} onResetSplit={vi.fn()} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Totals' }));

    // Each card shows its header total plus the receipt's row underneath.
    expect(screen.getAllByText('$10.00')).toHaveLength(2);
    expect(screen.getAllByText('$6.00')).toHaveLength(2);
  });

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

  it('names the combined total by its receipt count instead of an editable receipt name', () => {
    const alice = makePerson('Alice');
    const receipt1 = makeReceipt({
      id: 'r1',
      name: 'Dinner',
      items: [
        makeItem({
          amountInput: '10.00',
          assignment: equalShares([alice.id]),
        }),
      ],
    });
    const receipt2 = makeReceipt({
      id: 'r2',
      name: 'Drinks',
      items: [
        makeItem({
          amountInput: '5.00',
          assignment: equalShares([alice.id]),
        }),
      ],
    });

    seedStore([alice], [receipt1, receipt2], { activeReceiptId: 'r1' });

    render(<SummaryStep onAddReceipt={vi.fn()} onResetSplit={vi.fn()} />);

    // Defaults to the consolidated "total" tab when there are multiple receipts.
    const grandTotalLabel = within(screen.getByTestId('grand-total-card')).getByText(
      'Total · 2 receipts',
    );
    expect(grandTotalLabel.closest('[contenteditable="true"]')).toBeNull();
  });

  it('shows the selected foreign receipt discrepancy in its native currency', () => {
    const alice = makePerson('Alice');
    const assignment = equalShares([alice.id]);
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

    expect(screen.queryByText(/Mismatch found/)).toBeNull();
    fireEvent.mouseDown(screen.getByTestId('summary-tab-receipt-1'));
    expect(screen.getByText('Mismatch found (US$1.00)')).toBeInTheDocument();
  });

  it('rounds the foreign receipt rate beside the currency switch like the cards do', () => {
    const alice = makePerson('Alice');
    const assignment = equalShares([alice.id]);
    seedStore(
      [alice],
      [makeReceipt({ currency: 'IDR', items: [makeItem({ amountInput: '50000', assignment })] })],
      { exchangeRates: { SGD: 1, IDR: 0.000083 } },
    );

    render(<SummaryStep onAddReceipt={vi.fn()} onResetSplit={vi.fn()} />);

    expect(screen.getByRole('group', { name: 'Currency' })).toBeInTheDocument();
    expect(screen.queryByText(/12048\.\d/)).toBeNull();
    expect(screen.getAllByText(/1 SGD = 12,048 IDR/).length).toBeGreaterThan(1);
  });

  it('corrects a lower receipt total with a discount, and keeps the button for a gap it cannot close', () => {
    const alice = makePerson('Alice');
    seedStore(
      [alice],
      [
        makeReceipt({
          id: 'r1',
          items: [makeItem({ amountInput: '1.00', assignment: equalShares([alice.id]) })],
          serviceCharge: amountCharge('0.50'),
          receiptTotalInput: '0.10',
        }),
      ],
    );
    render(<SummaryStep onAddReceipt={vi.fn()} onResetSplit={vi.fn()} />);

    fireEvent.click(screen.getByTestId('apply-discount-reconcile-btn'));
    const afterFirstTap = useReceiptStore.getState().receipts;
    expect(afterFirstTap[0].discount).toMatchObject({ mode: 'amount', amountInput: '1.00' });
    expect(screen.getByText(/Mismatch found/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('apply-discount-reconcile-btn'));
    expect(useReceiptStore.getState().receipts).toBe(afterFirstTap);
  });

  it('adds a short receipt total as rounding that every card then shows', () => {
    const alice = makePerson('Alice');
    const bob = makePerson('Bob');
    seedStore(
      [alice, bob],
      [
        makeReceipt({
          id: 'r1',
          items: [
            makeItem({
              amountInput: '10.00',
              assignment: equalShares([alice.id, bob.id]),
            }),
          ],
          receiptTotalInput: '10.40',
        }),
      ],
    );

    render(<SummaryStep onAddReceipt={vi.fn()} onResetSplit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add $0.40 as rounding' }));

    expect(screen.queryByText(/Mismatch found/)).toBeNull();
    expect(screen.queryByText('Totals match!')).toBeNull();
    expect(screen.getAllByText('Rounding')).toHaveLength(2);
  });

  it.each<[CurrencyCode[], boolean]>([
    [['IDR', 'IDR'], true],
    [['IDR', 'USD'], false],
  ])(
    'totals %j receipts as billed only when they share one currency',
    (currencies, totalsAsBilled) => {
      const alice = makePerson('Alice');
      const assignment = equalShares([alice.id]);
      const receipts = currencies.map((currency, index) =>
        makeReceipt({
          id: `r${index}`,
          currency,
          items: [makeItem({ amountInput: '50000', assignment })],
        }),
      );
      seedStore([alice], receipts, { exchangeRates: { SGD: 1, IDR: 0.00008, USD: 1.35 } });

      render(<SummaryStep onAddReceipt={vi.fn()} onResetSplit={vi.fn()} />);

      const grandTotal = screen.getByTestId('grand-total-card');
      expect(grandTotal.textContent?.includes('Rp')).toBe(totalsAsBilled);
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
              assignment: equalShares([alice.id, bob.id]),
            }),
            makeItem({
              name: 'Kopi',
              amountInput: '2.20',
              assignment: equalShares([bob.id]),
            }),
          ],
        }),
      ],
    );
    render(<SummaryStep onAddReceipt={vi.fn()} onResetSplit={vi.fn()} />);

    const byPerson = screen.getByRole('radio', { name: 'By person' });
    const overviewToggle = screen.getByRole('radio', { name: 'Overview' });
    expect(byPerson).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('region', { name: 'Who had what' })).toBeNull();

    fireEvent.click(overviewToggle);

    expect(overviewToggle).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('group', { name: 'Show on each card' })).toBeNull();
    const table = within(screen.getByRole('region', { name: 'Who had what' }));
    expect(table.getByRole('rowheader', { name: /Laksa/ })).toHaveTextContent('$10.00');
    expect(table.getByRole('rowheader', { name: /Owes/ })).toHaveTextContent('of $12.20');
    expect(table.getByRole('row', { name: /Owes/ })).toHaveTextContent('$5.00$7.20');
    expect(table.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'PayNow' })).toBeNull();
    expect(screen.getByTestId('export-copy-text-btn')).toBeInTheDocument();

    fireEvent.click(byPerson);

    expect(screen.queryByRole('region', { name: 'Who had what' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Show on each card' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PayNow' })).toBeInTheDocument();
  });

  it('keeps the PayNow number hidden until the PayNow button is tapped', () => {
    seedDinner();
    render(<SummaryStep onAddReceipt={vi.fn()} onResetSplit={vi.fn()} />);
    const payNow = screen.getByRole('button', { name: 'PayNow' });

    expect(payNow).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('PayNow Number')).toBeNull();

    fireEvent.click(payNow);

    expect(payNow).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('PayNow Number')).toHaveFocus();

    fireEvent.click(payNow);

    expect(payNow).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('PayNow Number')).toBeNull();
  });
  it('shows QR readiness only after generation and replaces it when the number changes', async () => {
    seedDinner();
    const aliceId = useReceiptStore.getState().people[0].id;
    let complete!: (urls: Record<string, string>) => void;
    generatePaynowQrDataUrls.mockImplementation(
      () =>
        new Promise<Record<string, string>>((resolve) => {
          complete = resolve;
        }),
    );
    render(<SummaryStep onAddReceipt={vi.fn()} onResetSplit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'PayNow' }));
    fireEvent.change(screen.getByLabelText('PayNow Number'), { target: { value: '91234567' } });
    const card = within(screen.getByTestId('grand-total-card'));
    expect(card.getByRole('status')).toHaveTextContent(/Generating/);
    expect(card.queryByLabelText('PayNow QR codes ready')).toBeNull();
    await act(async () => complete({ [aliceId]: 'data:image/png;base64,qr' }));
    expect(card.getByLabelText('PayNow QR codes ready')).toBeInTheDocument();
    expect(screen.getByAltText('PayNow QR for Alice')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('PayNow Number'), { target: { value: '123' } });
    expect(card.queryByLabelText('PayNow QR codes ready')).toBeNull();
    expect(card.getByRole('status')).toHaveTextContent(/valid SG mobile number/);
    expect(screen.queryByAltText('PayNow QR for Alice')).toBeNull();
    fireEvent.change(screen.getByLabelText('PayNow Number'), { target: { value: '' } });
    expect(card.queryByRole('status')).toBeNull();
  });
});
