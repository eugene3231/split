import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ClaimPerson } from '@features/split-workspace/logic/claim';
import { ClaimantAvatars } from './ClaimantAvatars';

const person = (id: string, name: string, colorIndex: number): ClaimPerson => ({
  id,
  name,
  colorIndex,
  firstName: name,
  totalCents: 0,
  itemCount: 0,
  isActive: false,
});

describe('ClaimantAvatars', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps a removed avatar only for its exit, without claiming the person still has the item', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { rerender } = render(
      <ClaimantAvatars claimants={[person('a', 'Alex', 0)]} leftLabel={null} testId="who" />,
    );
    rerender(<ClaimantAvatars claimants={[]} leftLabel={null} testId="who" />);
    expect(screen.getByTestId('claim-avatar-exiting-a')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img', { name: 'Alex' })).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByTestId('claim-avatar-exiting-a')).not.toBeInTheDocument();
    expect(screen.queryByTestId('who')).not.toBeInTheDocument();
  });

  it('keeps a re-added avatar after its old exit would have finished', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const alex = person('a', 'Alex', 0);
    const { rerender } = render(
      <ClaimantAvatars claimants={[alex]} leftLabel={null} testId="who" />,
    );
    rerender(<ClaimantAvatars claimants={[]} leftLabel={null} testId="who" />);
    expect(screen.getByTestId('claim-avatar-exiting-a')).toBeInTheDocument();
    rerender(<ClaimantAvatars claimants={[alex]} leftLabel={null} testId="who" />);
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByTestId('who')).toHaveAccessibleName('Alex');
    expect(screen.queryByTestId('claim-avatar-exiting-a')).not.toBeInTheDocument();
  });

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

  it('finishes an avatar exit even when another update arrives during it', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const alex = person('a', 'Alex', 0);
    const sam = person('b', 'Sam', 1);
    const { rerender } = render(
      <ClaimantAvatars claimants={[alex, sam]} leftLabel={null} testId="who" />,
    );
    rerender(<ClaimantAvatars claimants={[sam]} leftLabel={null} testId="who" />);
    act(() => vi.advanceTimersByTime(150));
    rerender(
      <ClaimantAvatars claimants={[{ ...sam, totalCents: 1000 }]} leftLabel={null} testId="who" />,
    );
    act(() => vi.advanceTimersByTime(30));
    expect(screen.queryByTestId('claim-avatar-exiting-a')).not.toBeInTheDocument();
    expect(screen.getByTestId('who')).toHaveAccessibleName('Sam');
  });

  it('uses the people order when adding a claimant before an existing one', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const alex = person('a', 'Alex', 0);
    const sam = person('b', 'Sam', 1);
    const { rerender } = render(
      <ClaimantAvatars claimants={[sam]} leftLabel={null} testId="who" />,
    );
    rerender(<ClaimantAvatars claimants={[alex, sam]} leftLabel={null} testId="who" />);
    expect(
      screen.getByText('Alex').compareDocumentPosition(screen.getByText('Sam')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('updates an overflow group without animating a person who had no visible avatar', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const many = ['A1', 'B2', 'C3', 'D4', 'E5', 'F6'].map((name, index) =>
      person(name, name, index),
    );
    const { rerender } = render(<ClaimantAvatars claimants={many} leftLabel={null} testId="who" />);
    rerender(<ClaimantAvatars claimants={many.slice(0, 5)} leftLabel={null} testId="who" />);
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.queryByTestId('claim-avatar-exiting-F6')).not.toBeInTheDocument();
  });

  it('folds people past the fourth avatar into a count', () => {
    const many = ['A1', 'B2', 'C3', 'D4', 'E5'].map((name, index) => person(name, name, index));
    render(<ClaimantAvatars claimants={many} leftLabel={null} testId="who" />);

    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.getByText('D4, E5')).toBeInTheDocument();
  });

  it('keeps a tapped name up for two seconds, and hides it on a second tap', () => {
    vi.useFakeTimers();
    render(<ClaimantAvatars claimants={[person('a', 'Alex', 0)]} leftLabel={null} testId="who" />);
    const label = screen.getByText('Alex');

    fireEvent.click(label);
    fireEvent.pointerLeave(label);
    act(() => vi.advanceTimersByTime(1999));
    expect(label).toHaveClass('opacity-100');

    act(() => vi.advanceTimersByTime(1));
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
