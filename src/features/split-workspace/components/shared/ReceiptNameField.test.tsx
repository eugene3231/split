import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ReceiptNameField } from './ReceiptNameField';

function renderField() {
  const onRename = vi.fn();
  render(<ReceiptNameField name="Lunch" onRename={onRename} />);
  return { onRename, title: screen.getByText('Lunch') };
}

it('keeps the name when the title is cleared', () => {
  const { onRename, title } = renderField();

  title.textContent = '  ';
  fireEvent.blur(title);

  expect(onRename).not.toHaveBeenCalled();
  expect(title).toHaveTextContent('Lunch');
});

it('keeps the name on Escape', () => {
  const { onRename, title } = renderField();

  title.textContent = 'Brunch';
  fireEvent.keyDown(title, { key: 'Escape' });

  expect(onRename).not.toHaveBeenCalled();
  expect(title).toHaveTextContent('Lunch');
});

it('renames on Enter', () => {
  const { onRename, title } = renderField();

  title.focus();
  title.textContent = 'Team lunch';
  fireEvent.keyDown(title, { key: 'Enter' });

  expect(onRename).toHaveBeenCalledWith('Team lunch');
});
