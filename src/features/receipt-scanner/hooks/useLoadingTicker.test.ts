import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLoadingTicker } from './useLoadingTicker';

describe('useLoadingTicker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls onTick at the specified interval when active', () => {
    const onTick = vi.fn();
    renderHook(() => useLoadingTicker({ isActive: true, onTick, intervalMs: 1000 }));

    expect(onTick).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onTick).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onTick).toHaveBeenCalledTimes(2);
  });

  it('does not call onTick when inactive', () => {
    const onTick = vi.fn();
    renderHook(() => useLoadingTicker({ isActive: false, onTick, intervalMs: 1000 }));

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onTick).not.toHaveBeenCalled();
  });

  it('stops the interval when isActive changes to false', () => {
    const onTick = vi.fn();
    const { rerender } = renderHook(
      ({ isActive }: { isActive: boolean }) =>
        useLoadingTicker({ isActive, onTick, intervalMs: 1000 }),
      { initialProps: { isActive: true } },
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onTick).toHaveBeenCalledTimes(1);

    rerender({ isActive: false });

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('cleans up the interval on unmount', () => {
    const onTick = vi.fn();
    const { unmount } = renderHook(() =>
      useLoadingTicker({ isActive: true, onTick, intervalMs: 1000 }),
    );

    unmount();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onTick).not.toHaveBeenCalled();
  });
});
