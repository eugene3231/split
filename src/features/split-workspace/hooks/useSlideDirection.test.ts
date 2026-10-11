import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSlideDirection } from './useSlideDirection';

describe('useSlideDirection', () => {
  it('starts without a direction', () => {
    const { result } = renderHook(() => useSlideDirection(2));

    expect(result.current).toBe('none');
  });

  it('follows the position forward and back', () => {
    const { result, rerender } = renderHook(({ position }) => useSlideDirection(position), {
      initialProps: { position: 0 },
    });

    rerender({ position: 2 });
    expect(result.current).toBe('forward');

    rerender({ position: 1 });
    expect(result.current).toBe('back');
  });

  it('keeps the last direction when the position stays put', () => {
    const { result, rerender } = renderHook(({ position }) => useSlideDirection(position), {
      initialProps: { position: 1 },
    });

    rerender({ position: 0 });
    rerender({ position: 0 });

    expect(result.current).toBe('back');
  });
});
