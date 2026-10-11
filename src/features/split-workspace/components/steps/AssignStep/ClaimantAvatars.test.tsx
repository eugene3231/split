import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ClaimPerson } from '@features/split-workspace/logic/claim';
import { ClaimantAvatars } from './ClaimantAvatars';

const person = (id: string, name: string, colorIndex: number): ClaimPerson => ({
  id,
  name,
  colorIndex,
  firstName: name,
  totalLabel: '$0.00',
  isActive: false,
});

describe('ClaimantAvatars', () => {
  it('shows an avatar per person, named for screen readers and on hover', () => {
    render(
      <ClaimantAvatars
        claimants={[person('a', 'Alex', 0), person('b', 'Sam', 1)]}
        leftLabel="1/2 left"
        testId="who"
      />,
    );

    expect(screen.getByTestId('who')).toHaveAccessibleName('Alex, Sam, 1/2 left');
    expect(screen.getAllByText('Alex')).toHaveLength(1);
    expect(screen.getByText('1/2 left')).toBeInTheDocument();
  });

  it('folds people past the fourth avatar into a count', () => {
    const many = ['A1', 'B2', 'C3', 'D4', 'E5'].map((name, index) => person(name, name, index));
    render(<ClaimantAvatars claimants={many} leftLabel={null} testId="who" />);

    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.getByText('D4, E5')).toBeInTheDocument();
  });

  it('keeps a tapped name up for a few seconds, and hides it on a second tap', () => {
    vi.useFakeTimers();
    render(<ClaimantAvatars claimants={[person('a', 'Alex', 0)]} leftLabel={null} testId="who" />);
    const label = screen.getByText('Alex');

    fireEvent.click(label);
    fireEvent.pointerLeave(label);
    act(() => vi.advanceTimersByTime(2500));
    expect(label).toHaveClass('opacity-100');

    act(() => vi.advanceTimersByTime(600));
    expect(label).not.toHaveClass('opacity-100');

    fireEvent.click(label);
    expect(label).toHaveClass('opacity-100');
    fireEvent.click(label);
    expect(label).not.toHaveClass('opacity-100');
    vi.useRealTimers();
  });

  it('renders nothing when nobody has the item', () => {
    const { container } = render(<ClaimantAvatars claimants={[]} leftLabel={null} testId="who" />);
    expect(container).toBeEmptyDOMElement();
  });
});
