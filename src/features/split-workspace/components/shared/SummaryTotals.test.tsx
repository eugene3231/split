import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { computeSplit } from '@features/split-workspace/logic/split/split';
import {
  disabledCharge,
  makeItem,
  makePerson,
  percentCharge,
} from '../../../../tests/integration/testHelpers';
import { SummaryTotals } from './SummaryTotals';

it('lists each charge once and ends on the computed total', () => {
  const person = makePerson('Alex');
  const serviceCharge = percentCharge('10');
  const gst = percentCharge('9');
  const split = computeSplit({
    people: [person],
    items: [
      makeItem({
        amountInput: '100.00',
        assignment: { mode: 'single', personId: person.id, personIds: [person.id] },
      }),
    ],
    discount: disabledCharge,
    serviceCharge,
    gst,
  });

  render(
    <SummaryTotals
      split={split}
      discount={disabledCharge}
      serviceCharge={serviceCharge}
      gst={gst}
    />,
  );

  expect(screen.getByText('$100.00')).toBeInTheDocument();
  expect(screen.getByText('+$10.00')).toBeInTheDocument();
  expect(screen.getByText('+$9.90')).toBeInTheDocument();
  expect(screen.getByText('$119.90')).toBeInTheDocument();
  expect(screen.getAllByText(/^\+/)).toHaveLength(2);
});
