import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  return { onClick, button: screen.getByTestId('chip'), label: screen.getByTestId('chip-label') };
}

describe('ItemActionChip', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('names the icon button for screen readers and clicks on a tap', () => {
    const { onClick, button, label } = renderChip();

    expect(button).toHaveAccessibleName('Split evenly');
    fireEvent.pointerDown(button, { pointerType: 'touch' });
    fireEvent.pointerUp(button, { pointerType: 'touch' });
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledOnce();
    expect(label).not.toHaveClass('opacity-100');
  });

  it('shows the label on a long press without clicking, then hides it', () => {
    const { onClick, button, label } = renderChip();

    fireEvent.pointerDown(button, { pointerType: 'touch' });
    act(() => vi.advanceTimersByTime(500));
    expect(label).toHaveClass('opacity-100');

    fireEvent.pointerUp(button, { pointerType: 'touch' });
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1300));
    expect(label).not.toHaveClass('opacity-100');
  });

  it('still shows the label on a disabled button', () => {
    const { label } = renderChip(true);

    fireEvent.pointerDown(label.parentElement!, { pointerType: 'touch' });
    act(() => vi.advanceTimersByTime(500));

    expect(label).toHaveClass('opacity-100');
  });
});
