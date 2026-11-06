import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DINNER_RECEIPT } from '@features/ux-prototypes/logic/prototypeReceipt';
import { usePrototypeSplit } from './usePrototypeSplit';

describe('usePrototypeSplit', () => {
  it('moves an item into a person total when they claim it', () => {
    const { result } = renderHook(() => usePrototypeSplit(DINNER_RECEIPT));
    expect(result.current.split.subtotalByPersonCents.tom).toBe(2160);

    act(() => result.current.toggle('kopi', 'tom'));

    expect(result.current.assignments.kopi).toEqual(['tom']);
    expect(result.current.split.subtotalByPersonCents.tom).toBe(2440);
  });

  it('clears an item back to unassigned', () => {
    const { result } = renderHook(() => usePrototypeSplit(DINNER_RECEIPT));

    act(() => result.current.assign('laksa', []));

    expect(result.current.split.unassignedItemCount).toBe(3);
    expect(result.current.split.subtotalByPersonCents.arjun).toBe(2160);
  });
});
