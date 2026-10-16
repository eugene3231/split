import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HoverLabel } from './HoverLabel';

function renderLabels() {
  render(
    <>
      <HoverLabel label="Totals" testId="totals-label" showOnTap>
        <button>Totals</button>
      </HoverLabel>
      <HoverLabel label="Their items" testId="their-label" showOnTap>
        <button>Their items</button>
      </HoverLabel>
      <HoverLabel label="All items" testId="all-label" showOnTap>
        <button>All items</button>
      </HoverLabel>
    </>,
  );
}

describe('HoverLabel', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows only the most recently tapped label during rapid taps', () => {
    renderLabels();
    fireEvent.click(screen.getByRole('button', { name: 'Totals' }));
    fireEvent.click(screen.getByRole('button', { name: 'Their items' }));
    fireEvent.click(screen.getByRole('button', { name: 'All items' }));

    expect(screen.getByTestId('totals-label')).not.toHaveClass('opacity-100');
    expect(screen.getByTestId('their-label')).not.toHaveClass('opacity-100');
    expect(screen.getByTestId('all-label')).toHaveClass('opacity-100');
  });

  it('shows only one hovered label and closes it after two seconds', () => {
    renderLabels();
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Totals' }), {
      pointerType: 'mouse',
    });
    expect(screen.getByTestId('totals-label')).toHaveClass('opacity-100');
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Their items' }), {
      pointerType: 'mouse',
    });
    expect(screen.getByTestId('totals-label')).not.toHaveClass('opacity-100');
    expect(screen.getByTestId('their-label')).toHaveClass('opacity-100');
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByTestId('their-label')).not.toHaveClass('opacity-100');
  });

  it('closes a tapped label after exactly two seconds', () => {
    renderLabels();
    fireEvent.click(screen.getByRole('button', { name: 'Totals' }));
    act(() => vi.advanceTimersByTime(1999));
    expect(screen.getByTestId('totals-label')).toHaveClass('opacity-100');
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId('totals-label')).not.toHaveClass('opacity-100');
  });

  it('gives a new label its full two seconds despite an older timer', () => {
    renderLabels();
    fireEvent.click(screen.getByRole('button', { name: 'Totals' }));
    act(() => vi.advanceTimersByTime(1000));
    fireEvent.click(screen.getByRole('button', { name: 'Their items' }));
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByTestId('their-label')).toHaveClass('opacity-100');
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByTestId('their-label')).not.toHaveClass('opacity-100');
  });

  it('shows the label on a held touch and swallows the tap that ends it', () => {
    const onClick = vi.fn();
    render(
      <HoverLabel label="Alice" testId="alice-label">
        <button onClick={onClick}>A</button>
      </HoverLabel>,
    );
    const avatar = screen.getByRole('button', { name: 'A' });

    fireEvent.pointerDown(avatar, { pointerType: 'touch' });
    act(() => vi.advanceTimersByTime(449));
    expect(screen.getByTestId('alice-label')).not.toHaveClass('opacity-100');
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId('alice-label')).toHaveClass('opacity-100');

    fireEvent.pointerUp(avatar, { pointerType: 'touch' });
    fireEvent.click(avatar);
    expect(onClick).not.toHaveBeenCalled();

    fireEvent.pointerDown(avatar, { pointerType: 'touch' });
    fireEvent.pointerUp(avatar, { pointerType: 'touch' });
    fireEvent.click(avatar);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows nothing when a touch is let go before it counts as held', () => {
    render(
      <HoverLabel label="Alice" testId="alice-label">
        <button>A</button>
      </HoverLabel>,
    );
    const avatar = screen.getByRole('button', { name: 'A' });

    fireEvent.pointerDown(avatar, { pointerType: 'touch' });
    act(() => vi.advanceTimersByTime(200));
    fireEvent.pointerLeave(avatar, { pointerType: 'touch' });
    act(() => vi.advanceTimersByTime(1000));

    expect(screen.getByTestId('alice-label')).not.toHaveClass('opacity-100');
  });
});
