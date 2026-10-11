import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { EditableItem } from '@shared/types';
import { disabledCharge, makeItem } from '../../../../tests/integration/testHelpers';
import { LineItemCard } from './LineItemCard';

const item = makeItem({
  name: 'Pan Seared Barramundi',
  amountInput: '270000.00',
  discountPercentInput: '10.50',
});

it('writes the price the way the receipt currency is written', () => {
  render(
    <LineItemCard
      item={item}
      discount={disabledCharge}
      currency="IDR"
      onUpdate={() => {}}
      onRemove={() => {}}
    />,
  );

  expect(screen.getByRole('textbox', { name: 'Price' })).toHaveValue('270,000');
  expect(screen.getByRole('textbox', { name: 'Price' }).previousElementSibling).toHaveTextContent(
    'Rp',
  );
  expect(screen.getByRole('textbox', { name: 'Discount percent' })).toHaveValue('10.5');
});

it('shows a dollar placeholder with cents and a rupiah one without', () => {
  const empty = { ...item, amountInput: '' };
  const { rerender } = render(
    <LineItemCard item={empty} discount={disabledCharge} onUpdate={() => {}} onRemove={() => {}} />,
  );
  expect(screen.getByRole('textbox', { name: 'Price' })).toHaveAttribute('placeholder', '0.00');

  rerender(
    <LineItemCard
      item={empty}
      discount={disabledCharge}
      currency="IDR"
      onUpdate={() => {}}
      onRemove={() => {}}
    />,
  );
  expect(screen.getByRole('textbox', { name: 'Price' })).toHaveAttribute('placeholder', '0');
});

it('saves the typed price as typed', () => {
  const onUpdate = vi.fn();
  render(
    <LineItemCard item={item} discount={disabledCharge} onUpdate={onUpdate} onRemove={() => {}} />,
  );
  const input = screen.getByRole('textbox', { name: 'Price' });

  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: '12.5' } });

  const updater = onUpdate.mock.calls[0]![0] as (current: EditableItem) => EditableItem;
  expect(updater(item).amountInput).toBe('12.5');
});
