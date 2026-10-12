import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { Receipt } from '@shared/types';
import { equalShares } from '@features/split-workspace/logic/assignment';
import { computeReceiptTotals } from '@features/split-workspace/logic/reconciliation';
import {
  selectActiveReceipt,
  useReceiptStore,
} from '@features/split-workspace/stores/receiptStore';
import {
  amountCharge,
  makeItem,
  makePerson,
  makeReceipt,
  percentCharge,
  resetAllStores,
  seedStore,
} from '../../../../tests/integration/testHelpers';
import { GlobalChargesPanel } from './GlobalChargesPanel';

/** The panel as the receipt step shows it: on the active receipt, re-rendering as it is edited. */
function ActiveReceiptPanel({ onAddRounding = () => {} }: { onAddRounding?: () => void }) {
  const receipt = useReceiptStore(selectActiveReceipt);
  const people = useReceiptStore((state) => state.people);
  return (
    <GlobalChargesPanel
      receipt={receipt}
      split={computeReceiptTotals(receipt, people)}
      reconciliationCents={100}
      onApplyDiscount={() => {}}
      onAddRounding={onAddRounding}
    />
  );
}

function renderPanel(receipt: Partial<Receipt> = {}, onAddRounding?: () => void) {
  seedStore(
    [],
    [makeReceipt({ id: 'r1', currency: 'JPY', receiptTotalInput: '1.00', ...receipt })],
  );
  return render(<ActiveReceiptPanel onAddRounding={onAddRounding} />);
}

beforeEach(() => {
  resetAllStores();
});

it('shows a receipt mismatch in the receipt currency', () => {
  renderPanel();

  expect(screen.getByText('Mismatch found (¥1)')).toBeInTheDocument();
});

it('lists the charge toggles in the order they are applied', () => {
  renderPanel();

  expect(screen.getAllByRole('switch').map((toggle) => toggle.getAttribute('aria-label'))).toEqual([
    'Global Discount',
    'Service Charge',
    'GST / Tax',
  ]);
});

it('offers to add a short receipt total as rounding', () => {
  const onAddRounding = vi.fn();
  renderPanel({}, onAddRounding);

  fireEvent.click(screen.getByRole('button', { name: 'Add ¥1 as rounding' }));

  expect(onAddRounding).toHaveBeenCalledOnce();
});

it('writes charge amounts and the receipt total the way the receipt currency is written', () => {
  renderPanel({
    currency: 'IDR',
    serviceCharge: amountCharge('71750.00'),
    receiptTotalInput: '1206500.00',
  });

  expect(screen.getByRole('textbox', { name: 'Service Charge amount' })).toHaveValue('71,750');
  expect(screen.getByTestId('receipt-total-input')).toHaveValue('1,206,500');
});

it('shows the receipt currency on the amount toggle and next to the amount', () => {
  renderPanel({ currency: 'IDR', serviceCharge: amountCharge('') });

  expect(screen.getByRole('radio', { name: 'Service Charge as an amount' })).toHaveTextContent(
    'Rp',
  );
  const input = screen.getByRole('textbox', { name: 'Service Charge amount' });
  expect(input.previousElementSibling).toHaveTextContent('Rp');
  expect(input).toHaveAttribute('placeholder', '0');
});

it('puts the percent sign after the percent', () => {
  renderPanel({ gst: percentCharge('9.00') });

  const input = screen.getByRole('textbox', { name: 'GST / Tax percent' });
  expect(input).toHaveValue('9');
  expect(input.previousElementSibling).toBeNull();
  expect(input.nextElementSibling).toHaveTextContent('%');
});

it('keeps what the person types until they leave the receipt total', () => {
  renderPanel({ currency: 'SGD', receiptTotalInput: '' });
  const input = screen.getByTestId('receipt-total-input');

  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: '1234.5' } });

  expect(useReceiptStore.getState().receipts[0].receiptTotalInput).toBe('1234.5');
  expect(input).toHaveValue('1234.5');

  fireEvent.blur(input);

  expect(input).toHaveValue('1,234.50');
});

it('writes each charge to its own field of the receipt', () => {
  renderPanel({ currency: 'SGD' });
  const before = useReceiptStore.getState().receipts[0];

  fireEvent.click(screen.getByRole('switch', { name: 'Service Charge' }));

  const after = useReceiptStore.getState().receipts[0];
  expect(after.serviceCharge.enabled).toBe(true);
  expect(after.discount).toBe(before.discount);
  expect(after.gst).toBe(before.gst);
});

it('takes the rounding off the receipt', () => {
  const alice = makePerson('Alice');
  const meal = makeItem({ amountInput: '10.00', assignment: equalShares([alice.id]) });
  seedStore([alice], [makeReceipt({ id: 'r1', items: [meal] })]);
  useReceiptStore.getState().patchReceipt('r1', { roundingInput: '0.02' });
  render(<ActiveReceiptPanel />);

  fireEvent.click(screen.getByTestId('remove-rounding-btn'));

  expect(useReceiptStore.getState().receipts[0].roundingInput).toBe('');
});
