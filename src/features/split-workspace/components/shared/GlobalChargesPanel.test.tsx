import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { computeSplit } from '@features/split-workspace/logic/split/split';
import { disabledCharge } from '../../../../tests/integration/testHelpers';
import { GlobalChargesPanel } from './GlobalChargesPanel';

function renderPanel(onAddRounding = () => {}) {
  return render(
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
      onAddRounding={onAddRounding}
      onRemoveRounding={() => {}}
      onDiscountChange={() => {}}
      onServiceChargeChange={() => {}}
      onGstChange={() => {}}
      onReceiptTotalInputChange={() => {}}
      currency="JPY"
    />,
  );
}

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
  renderPanel(onAddRounding);

  fireEvent.click(screen.getByRole('button', { name: 'Add ¥1 as rounding' }));

  expect(onAddRounding).toHaveBeenCalledOnce();
});
