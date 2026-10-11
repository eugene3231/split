import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { PeopleStep } from './PeopleStep';

beforeEach(() => {
  useReceiptStore.setState({
    people: [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' },
    ],
    peopleInput: '',
    receipts: [],
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('PeopleStep removal', () => {
  it('finishes removing a person even if the browser never sends animationend', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    render(<PeopleStep />);
    fireEvent.click(screen.getByTestId('person-chip-p1'));
    expect(screen.getByTestId('person-chip-p1')).toBeDisabled();
    expect(useReceiptStore.getState().people.map((person) => person.name)).toEqual([
      'Alice',
      'Bob',
    ]);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByTestId('person-chip-p1')).not.toBeInTheDocument();
    expect(useReceiptStore.getState().people.map((person) => person.name)).toEqual(['Bob']);
  });

  it('finishes every pending removal on unmount in StrictMode', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { unmount } = render(
      <StrictMode>
        <PeopleStep />
      </StrictMode>,
    );
    fireEvent.click(screen.getByTestId('person-chip-p1'));
    fireEvent.click(screen.getByTestId('person-chip-p2'));
    unmount();
    expect(useReceiptStore.getState().people).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('finishes only the chip whose exit animation completed', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    render(<PeopleStep />);
    const aliceChip = screen.getByTestId('person-chip-p1');
    fireEvent.click(aliceChip);
    fireEvent.click(screen.getByTestId('person-chip-p2'));
    const end = new Event('webkitAnimationEnd', { bubbles: true });
    Object.defineProperty(end, 'animationName', { value: 'shrink-out' });
    fireEvent(aliceChip, end);
    expect(useReceiptStore.getState().people.map((person) => person.name)).toEqual(['Bob']);
    expect(screen.getByTestId('person-chip-p2')).toBeDisabled();
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(1000));
    expect(useReceiptStore.getState().people).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('removes a person immediately when reduced motion is enabled', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    render(<PeopleStep />);
    fireEvent.click(screen.getByTestId('person-chip-p1'));
    expect(screen.queryByTestId('person-chip-p1')).not.toBeInTheDocument();
    expect(useReceiptStore.getState().people.map((person) => person.name)).toEqual(['Bob']);
    expect(vi.getTimerCount()).toBe(0);
  });
});
