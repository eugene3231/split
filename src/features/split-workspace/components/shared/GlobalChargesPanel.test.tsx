import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { computeSplit } from '@features/split-workspace/logic/split/split';
import { disabledCharge } from '../../../../tests/integration/testHelpers';
import { GlobalChargesPanel } from './GlobalChargesPanel';

it('shows a receipt mismatch in the receipt currency', () => {
  render(
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

  expect(screen.getByText('Mismatch found (¥1.00)')).toBeInTheDocument();
});
