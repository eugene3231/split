import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Receipt } from '@shared/types';
import {
  disabledCharge,
  makeItem,
  makeReceipt,
  percentCharge,
  resetAllStores,
  seedStore,
} from '../../../../../tests/integration/testHelpers';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { equalShares } from '@features/split-workspace/logic/assignment';
import { ReceiptStep } from './ReceiptStep';

// Scanning has its own tests; everything else on the step is real.
vi.mock('./ReceiptImportActions', () => ({
  ReceiptImportActions: () => null,
}));

vi.mock('./useReceiptImport', () => ({
  useReceiptImport: () => ({
    handleReceiptFileChange: vi.fn(),
    handleScanReceipt: vi.fn(),
  }),
}));

const alice = { id: 'alice', name: 'Alice' };

function renderReceipt(receipt: Partial<Receipt> = {}) {
  seedStore(
    [alice],
    [
      makeReceipt({
        id: 'r1',
        name: 'Lunch',
        items: [
          makeItem({
            id: 'laksa',
            name: 'Laksa',
            amountInput: '10.00',
            assignment: equalShares([alice.id]),
          }),
        ],
        ...receipt,
      }),
    ],
  );
  render(<ReceiptStep onAddReceipt={vi.fn()} />);
}

function activeReceipt() {
  return useReceiptStore.getState().receipts[0];
}

function computedTotal() {
  return screen.getByText('Computed Total').parentElement;
}

function receiptTitle() {
  const title = screen
    .getAllByText('Lunch')
    .find((element) => element.getAttribute('contenteditable') === 'true');
  if (!title) throw new Error('The receipt title is not editable');
  return title;
}

beforeEach(resetAllStores);

describe('ReceiptStep', () => {
  it('adds a first item to a receipt that has none', () => {
    renderReceipt({ items: [] });
    expect(screen.getByTestId('receipt-empty-state')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('receipt-add-item-btn'));

    expect(activeReceipt().items).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: 'Price' })).toHaveValue('');
  });

  it('shows the receipt on the selected tab, and its items', () => {
    seedStore(
      [],
      [
        makeReceipt({ id: 'r1', name: 'Lunch', items: [makeItem({ id: 'a' })] }),
        makeReceipt({
          id: 'r2',
          name: 'Dinner',
          items: [makeItem({ id: 'b' }), makeItem({ id: 'c' })],
        }),
      ],
    );
    render(<ReceiptStep onAddReceipt={vi.fn()} />);
    expect(screen.getAllByRole('button', { name: 'Remove item' })).toHaveLength(1);

    act(() => useReceiptStore.getState().setActiveReceiptId('r2'));

    expect(screen.getAllByRole('button', { name: 'Remove item' })).toHaveLength(2);
    expect(screen.getByText('2 items')).toBeInTheDocument();
  });

  it('edits an item’s name, price and line discount, and totals them', () => {
    renderReceipt();

    fireEvent.change(screen.getByDisplayValue('Laksa'), { target: { value: 'Prawn laksa' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Price' }), {
      target: { value: '12.00' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Discount$/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Discount percent' }), {
      target: { value: '25' },
    });

    expect(activeReceipt().items[0]).toMatchObject({
      name: 'Prawn laksa',
      amountInput: '12.00',
      discountPercentInput: '25',
    });
    expect(computedTotal()).toHaveTextContent('$9.00');
  });

  it('clears the line discount when it is removed', () => {
    renderReceipt({
      items: [
        makeItem({
          id: 'laksa',
          amountInput: '10.00',
          discountPercentInput: '50',
          assignment: equalShares([alice.id]),
        }),
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remove discount' }));

    expect(activeReceipt().items[0].discountPercentInput).toBe('');
    expect(screen.getByRole('button', { name: /Discount$/ })).toBeInTheDocument();
  });

  it('adds a blank item and removes one', () => {
    renderReceipt();

    fireEvent.click(screen.getByTestId('receipt-add-item-btn'));
    expect(activeReceipt().items.map((item) => item.amountInput)).toEqual(['10.00', '']);

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove item' })[0]);
    expect(activeReceipt().items.map((item) => item.amountInput)).toEqual(['']);
  });

  it('turns GST off and drops it from the total', () => {
    renderReceipt({ serviceCharge: disabledCharge, gst: percentCharge('9') });
    expect(computedTotal()).toHaveTextContent('$10.90');

    fireEvent.click(screen.getByRole('switch', { name: 'GST / Tax' }));

    expect(activeReceipt().gst.enabled).toBe(false);
    expect(computedTotal()).toHaveTextContent('$10.00');
  });

  it('renames the receipt from its title, and keeps the name on Escape or a blank title', () => {
    renderReceipt();
    const title = receiptTitle();

    title.textContent = '  ';
    fireEvent.blur(title);
    expect(activeReceipt().name).toBe('Lunch');
    expect(title).toHaveTextContent('Lunch');

    title.textContent = 'Brunch';
    fireEvent.keyDown(title, { key: 'Escape' });
    expect(activeReceipt().name).toBe('Lunch');
    expect(title).toHaveTextContent('Lunch');

    title.focus();
    title.textContent = 'Team lunch';
    fireEvent.keyDown(title, { key: 'Enter' });
    expect(activeReceipt().name).toBe('Team lunch');
  });

  it('prices items in a new currency and forgets the rate typed for the old one', () => {
    renderReceipt({
      currency: 'USD',
      exchangeRateOverride: 1.5,
      serviceCharge: disabledCharge,
      gst: disabledCharge,
    });
    expect(screen.getByText('Manual')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'JPY' } });

    expect(activeReceipt()).toMatchObject({ currency: 'JPY', exchangeRateOverride: null });
    expect(screen.getByText('Auto')).toBeInTheDocument();
    expect(computedTotal()).toHaveTextContent('¥10');
  });
});
