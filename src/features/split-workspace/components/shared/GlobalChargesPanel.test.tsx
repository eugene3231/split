import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Receipt } from '@shared/types';
import { equalShares } from '@features/split-workspace/logic/assignment';
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
function ActiveReceiptPanel() {
  return <GlobalChargesPanel receipt={useReceiptStore(selectActiveReceipt)} />;
}

function renderPanel(receipt: Partial<Receipt> = {}) {
  seedStore(
    [],
    [makeReceipt({ id: 'r1', currency: 'JPY', receiptTotalInput: '1.00', ...receipt })],
  );
  return render(<ActiveReceiptPanel />);
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
    'Tip',
  ]);
});

it('adds a short receipt total as rounding, after which the totals match', () => {
  const alice = makePerson('Alice');
  const meal = makeItem({ amountInput: '10.00', assignment: equalShares([alice.id]) });
  seedStore([alice], [makeReceipt({ id: 'r1', items: [meal], receiptTotalInput: '10.40' })]);
  render(<ActiveReceiptPanel />);

  fireEvent.click(screen.getByRole('button', { name: 'Add $0.40 as rounding' }));

  expect(useReceiptStore.getState().receipts[0].roundingInput).toBe('0.40');
  expect(screen.getByText('Totals match!')).toBeInTheDocument();
});

it('reaches a lower receipt total with a discount before tax', () => {
  const alice = makePerson('Alice');
  const meal = makeItem({ amountInput: '100.00', assignment: equalShares([alice.id]) });
  const receipt = makeReceipt({
    id: 'r1',
    items: [meal],
    discount: percentCharge('5'),
    serviceCharge: percentCharge('10'),
    gst: percentCharge('9'),
    receiptTotalInput: '107.91',
  });
  seedStore([alice], [receipt]);
  render(<ActiveReceiptPanel />);

  fireEvent.click(screen.getByTestId('apply-discount-reconcile-btn'));

  expect(useReceiptStore.getState().receipts[0].discount).toMatchObject({
    mode: 'amount',
    amountInput: '10.00',
  });
  expect(screen.getByText('Totals match!')).toBeInTheDocument();
});

it('keeps showing a gap no discount can close, and a second tap changes nothing', () => {
  const alice = makePerson('Alice');
  const meal = makeItem({ amountInput: '1.00', assignment: equalShares([alice.id]) });
  const receipt = makeReceipt({
    id: 'r1',
    items: [meal],
    serviceCharge: amountCharge('0.50'),
    receiptTotalInput: '0.10',
  });
  seedStore([alice], [receipt]);
  render(<ActiveReceiptPanel />);

  fireEvent.click(screen.getByTestId('apply-discount-reconcile-btn'));

  expect(screen.getByText('Mismatch found ($0.40)')).toBeInTheDocument();
  const afterFirstTap = useReceiptStore.getState().receipts;
  expect(afterFirstTap[0].discount).toMatchObject({ mode: 'amount', amountInput: '1.00' });

  fireEvent.click(screen.getByTestId('apply-discount-reconcile-btn'));

  expect(useReceiptStore.getState().receipts).toBe(afterFirstTap);
  expect(screen.getByText('Mismatch found ($0.40)')).toBeInTheDocument();
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

describe('tip', () => {
  function renderMeal(peopleCount: number, receipt: Partial<Receipt> = {}) {
    const people = Array.from({ length: peopleCount }, (_, index) => makePerson(`P${index}`));
    const meal = makeItem({ amountInput: '10.00', assignment: equalShares([people[0].id]) });
    seedStore(people, [makeReceipt({ id: 'r1', items: [meal], ...receipt })]);
    render(<ActiveReceiptPanel />);
  }

  it('starts at 18% and adds the tip to the computed total', () => {
    renderMeal(2);

    fireEvent.click(screen.getByRole('switch', { name: 'Tip' }));

    expect(useReceiptStore.getState().receipts[0].tip).toMatchObject({
      enabled: true,
      mode: 'percent',
      percentInput: '18',
    });
    expect(screen.getByRole('radio', { name: '18%' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Tip (18%)')).toBeInTheDocument();
    expect(screen.getByText('$11.80')).toBeInTheDocument();
  });

  it('starts at 20% for a group of six', () => {
    renderMeal(6);

    fireEvent.click(screen.getByRole('switch', { name: 'Tip' }));

    expect(useReceiptStore.getState().receipts[0].tip.percentInput).toBe('20');
    expect(screen.getByTestId('tip-hint')).toHaveTextContent('6 or more people');
  });

  it('points out a service charge already on the receipt', () => {
    renderMeal(2, { serviceCharge: percentCharge('10') });

    fireEvent.click(screen.getByRole('switch', { name: 'Tip' }));

    expect(screen.getByTestId('tip-hint')).toHaveTextContent('already has a service charge');
  });

  it('sets the tip from a preset', () => {
    renderMeal(2, { tip: percentCharge('18') });

    fireEvent.click(screen.getByRole('radio', { name: '22%' }));

    expect(useReceiptStore.getState().receipts[0].tip.percentInput).toBe('22');
    expect(screen.queryByRole('textbox', { name: 'Tip percent' })).toBeNull();
  });

  it('keeps a custom tip open while typing a value that matches a preset', () => {
    renderMeal(2, { tip: percentCharge('18') });

    fireEvent.click(screen.getByRole('radio', { name: 'Custom' }));
    const input = screen.getByRole('textbox', { name: 'Tip percent' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '20' } });

    expect(useReceiptStore.getState().receipts[0].tip.percentInput).toBe('20');
    expect(screen.getByRole('textbox', { name: 'Tip percent' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Custom' })).toHaveAttribute('aria-checked', 'true');
  });

  it('opens on the custom field for a fixed tip', () => {
    renderMeal(2, { tip: amountCharge('5.00') });

    expect(screen.getByRole('textbox', { name: 'Tip amount' })).toHaveValue('5.00');
    expect(screen.getByText('$15.00')).toBeInTheDocument();
  });

  it('checks the printed total without the tip', () => {
    renderMeal(2, { tip: percentCharge('20'), receiptTotalInput: '10.00' });

    expect(screen.getByText('Totals match!')).toBeInTheDocument();
  });
});
