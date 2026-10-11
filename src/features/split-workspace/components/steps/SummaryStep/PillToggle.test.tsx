import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PillToggle } from './PillToggle';

function renderToggle(onChange = vi.fn()) {
  render(
    <PillToggle
      label="Currency"
      options={[
        { value: 'billed', label: 'As billed' },
        { value: 'base', label: '$ SGD' },
      ]}
      value="billed"
      onChange={onChange}
    />,
  );
  return onChange;
}

describe('PillToggle', () => {
  it('reports the option picked', () => {
    const onChange = renderToggle();

    fireEvent.click(screen.getByRole('radio', { name: '$ SGD' }));

    expect(onChange).toHaveBeenCalledWith('base');
  });

  it('keeps an option picked when it is tapped again', () => {
    const onChange = renderToggle();

    fireEvent.click(screen.getByRole('radio', { name: 'As billed' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: 'As billed' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('moves between options with the arrow keys', async () => {
    renderToggle();
    const billed = screen.getByRole('radio', { name: 'As billed' });

    billed.focus();
    fireEvent.keyDown(billed, { key: 'ArrowRight' });

    await waitFor(() => expect(screen.getByRole('radio', { name: '$ SGD' })).toHaveFocus());
  });
});
