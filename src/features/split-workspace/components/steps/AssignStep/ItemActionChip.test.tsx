import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ItemActionChip } from './ItemActionChip';

function renderChip(disabled = false) {
  const onClick = vi.fn();
  render(
    <ItemActionChip
      icon="groups"
      label="Everyone"
      description="Split evenly with everyone"
      disabled={disabled}
      onClick={onClick}
      testId="chip"
    />,
  );
  return { onClick, button: screen.getByTestId('chip') };
}

describe('ItemActionChip', () => {
  it('shows a short label and names what it does for screen readers', () => {
    const { onClick, button } = renderChip();

    expect(button).toHaveTextContent('Everyone');
    expect(button).toHaveAccessibleName('Split evenly with everyone');
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('keeps its label on a disabled chip', () => {
    const { button } = renderChip(true);

    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Everyone');
  });
});
