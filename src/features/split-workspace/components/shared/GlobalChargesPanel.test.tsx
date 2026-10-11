import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { expect, it, vi } from 'vitest';
import { computeSplit } from '@features/split-workspace/logic/split/split';
import {
  amountCharge,
  disabledCharge,
  percentCharge,
} from '../../../../tests/integration/testHelpers';
import { GlobalChargesPanel } from './GlobalChargesPanel';

function panel(overrides: Partial<ComponentProps<typeof GlobalChargesPanel>> = {}) {
  return (
    <GlobalChargesPanel
      split={computeSplit({
        people: [],
        items: [],
        discount: disabledCharge,
        serviceCharge: disabledCharge,
        gst: disabledCharge,
      })}
      discount={disabledCharge}
      serviceCharge={disabledCharge}
      gst={disabledCharge}
      reconciliationCents={100}
      receiptTotalInput="1.00"
      onApplyDiscount={() => {}}
      onAddRounding={() => {}}
      onRemoveRounding={() => {}}
      onDiscountChange={() => {}}
      onServiceChargeChange={() => {}}
      onGstChange={() => {}}
      onReceiptTotalInputChange={() => {}}
      currency="JPY"
      {...overrides}
    />
  );
}

it('shows a receipt mismatch in the receipt currency', () => {
  render(panel());

  expect(screen.getByText('Mismatch found (¥1)')).toBeInTheDocument();
});

it('lists the charge toggles in the order they are applied', () => {
  render(panel());

  expect(screen.getAllByRole('switch').map((toggle) => toggle.getAttribute('aria-label'))).toEqual([
    'Global Discount',
    'Service Charge',
    'GST / Tax',
  ]);
});

it('offers to add a short receipt total as rounding', () => {
  const onAddRounding = vi.fn();
  render(panel({ onAddRounding }));

  fireEvent.click(screen.getByRole('button', { name: 'Add ¥1 as rounding' }));

  expect(onAddRounding).toHaveBeenCalledOnce();
});

it('writes charge amounts and the receipt total the way the receipt currency is written', () => {
  render(
    panel({
      currency: 'IDR',
      serviceCharge: amountCharge('71750.00'),
      receiptTotalInput: '1206500.00',
    }),
  );

  expect(screen.getByRole('textbox', { name: 'Service Charge amount' })).toHaveValue('71,750');
  expect(screen.getByTestId('receipt-total-input')).toHaveValue('1,206,500');
});

it('shows the receipt currency on the amount toggle and next to the amount', () => {
  render(panel({ currency: 'IDR', serviceCharge: amountCharge('') }));

  expect(screen.getByRole('button', { name: 'Service Charge as an amount' })).toHaveTextContent(
    'Rp',
  );
  const input = screen.getByRole('textbox', { name: 'Service Charge amount' });
  expect(input.previousElementSibling).toHaveTextContent('Rp');
  expect(input).toHaveAttribute('placeholder', '0');
});

it('puts the percent sign after the percent', () => {
  render(panel({ gst: percentCharge('9.00') }));

  const input = screen.getByRole('textbox', { name: 'GST / Tax percent' });
  expect(input).toHaveValue('9');
  expect(input.previousElementSibling).toBeNull();
  expect(input.nextElementSibling).toHaveTextContent('%');
});

it('keeps what the person types until they leave the receipt total', () => {
  const onReceiptTotalInputChange = vi.fn();
  const { rerender } = render(
    panel({ currency: 'SGD', receiptTotalInput: '', onReceiptTotalInputChange }),
  );
  const input = screen.getByTestId('receipt-total-input');

  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: '1234.5' } });
  rerender(panel({ currency: 'SGD', receiptTotalInput: '1234.5', onReceiptTotalInputChange }));

  expect(onReceiptTotalInputChange).toHaveBeenCalledWith('1234.5');
  expect(input).toHaveValue('1234.5');

  fireEvent.blur(input);

  expect(input).toHaveValue('1,234.50');
});
