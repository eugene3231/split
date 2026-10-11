import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAllAssignedMoment } from './useAllAssignedMoment';

const render = (leftCount: number) =>
  renderHook(({ left }) => useAllAssignedMoment(left), { initialProps: { left: leftCount } });

describe('useAllAssignedMoment', () => {
  it('stays quiet when everything was already assigned', () => {
    const { result } = render(0);

    expect(result.current).toBe(false);
  });

  it('fires when the last item gets assigned', () => {
    const { result, rerender } = render(2);

    rerender({ left: 1 });
    expect(result.current).toBe(false);
    rerender({ left: 0 });
    expect(result.current).toBe(true);
  });

  it('clears once an item is left again', () => {
    const { result, rerender } = render(1);

    rerender({ left: 0 });
    rerender({ left: 1 });

    expect(result.current).toBe(false);
  });
});
