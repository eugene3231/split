import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ItemActionChip } from './ItemActionChip';

function renderChip(disabled = false) {
  const onClick = vi.fn();
  render(
    <ItemActionChip
      icon="groups"
      label="Split evenly"
      disabled={disabled}
      onClick={onClick}
      testId="chip"
    />,
  );
  return { onClick, button: screen.getByTestId('chip') };
}

describe('ItemActionChip', () => {
  it('shows its label on the button and clicks on a tap', () => {
    const { onClick, button } = renderChip();

    expect(button).toHaveAccessibleName('Split evenly');
    expect(button).toHaveTextContent('Split evenly');
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does nothing while disabled', () => {
    const { onClick, button } = renderChip(true);

    expect(button).toBeDisabled();
    fireEvent.click(button);

    expect(onClick).not.toHaveBeenCalled();
  });
});
