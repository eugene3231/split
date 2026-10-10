import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { computeSplit } from '@features/split-workspace/logic/split/split';
import { disabledCharge } from '../../../../tests/integration/testHelpers';
import { GlobalChargesPanel } from './GlobalChargesPanel';

function renderPanel() {
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
