import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CountUpAmount } from './CountUpAmount';

function allowMotion() {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('no-preference') }));
}

describe('CountUpAmount', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('jumps straight to a new amount when motion is not allowed', () => {
    const { rerender } = render(<CountUpAmount cents={500} currency="SGD" />);

    rerender(<CountUpAmount cents={1250} currency="SGD" />);

    expect(screen.getByText('$12.50')).toBeInTheDocument();
  });

  it('counts from the old amount to the new one', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    allowMotion();
    const { container, rerender } = render(<CountUpAmount cents={500} currency="SGD" />);

    rerender(<CountUpAmount cents={1250} currency="SGD" />);
    expect(container).toHaveTextContent('$5.00');

    act(() => vi.advanceTimersByTime(200));
    const midway = container.textContent;
    expect(midway).not.toBe('$5.00');
    expect(midway).not.toBe('$12.50');

    act(() => vi.advanceTimersByTime(400));
    expect(container).toHaveTextContent('$12.50');
  });
});
