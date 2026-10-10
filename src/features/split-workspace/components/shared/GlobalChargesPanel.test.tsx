import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { computeSplit } from '@features/split-workspace/logic/split/split';
import { disabledCharge } from '../../../../tests/integration/testHelpers';
import { GlobalChargesPanel } from './GlobalChargesPanel';
import { defaultTipState } from '@features/split-workspace/constants';

it('shows a receipt mismatch in the receipt currency', () => {
  render(
    <GlobalChargesPanel
      split={computeSplit({
        people: [],
        items: [],
        discount: disabledCharge,
        serviceCharge: disabledCharge,
        gst: disabledCharge,
        tip: defaultTipState,
      })}
      discount={disabledCharge}
      serviceCharge={disabledCharge}
      gst={disabledCharge}
      tip={defaultTipState}
      reconciliationCents={100}
      receiptTotalInput="1.00"
      onApplyDiscount={() => {}}
      onDiscountChange={() => {}}
      onServiceChargeChange={() => {}}
      onGstChange={() => {}}
      onTipChange={() => {}}
      onReceiptTotalInputChange={() => {}}
      currency="JPY"
    />,
  );

  expect(screen.getByText('Mismatch found (¥1.00)')).toBeInTheDocument();
});
