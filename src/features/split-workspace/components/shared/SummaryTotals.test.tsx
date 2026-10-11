import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
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
      onRemoveRounding={() => {}}
    />,
  );

  expect(screen.getByText('$100.00')).toBeInTheDocument();
  expect(screen.getByText('+$10.00')).toBeInTheDocument();
  expect(screen.getByText('+$9.90')).toBeInTheDocument();
  expect(screen.getByText('$119.90')).toBeInTheDocument();
  expect(screen.getAllByText(/^\+/)).toHaveLength(2);
});

it('shows rounding after tax with a way to remove it', () => {
  const person = makePerson('Alex');
  const gst = percentCharge('9');
  const split = computeSplit({
    people: [person],
    items: [
      makeItem({
        amountInput: '10.00',
        assignment: { mode: 'single', personId: person.id, personIds: [person.id] },
      }),
    ],
    discount: disabledCharge,
    serviceCharge: disabledCharge,
    gst,
    roundingInput: '0.10',
  });
  const onRemoveRounding = vi.fn();

  render(
    <SummaryTotals
      split={split}
      discount={disabledCharge}
      serviceCharge={disabledCharge}
      gst={gst}
      onRemoveRounding={onRemoveRounding}
    />,
  );

  expect(screen.getByText('+$0.90')).toBeInTheDocument();
  expect(screen.getByText('+$0.10')).toBeInTheDocument();
  expect(screen.getByText('$11.00')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Remove rounding' }));
  expect(onRemoveRounding).toHaveBeenCalledOnce();
});
