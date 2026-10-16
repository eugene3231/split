import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ClaimPerson } from '@features/split-workspace/logic/claim';
import { useClaimantPresence } from './useClaimantPresence';

const person = (id: string): ClaimPerson => ({
  id,
  name: id,
  colorIndex: 0,
  firstName: id,
  totalCents: 0,
  isActive: false,
});

const entering = (avatars: { person: ClaimPerson; isEntering: boolean }[]) =>
  avatars.filter((avatar) => avatar.isEntering).map((avatar) => avatar.person.id);

describe('useClaimantPresence', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('animates in only the avatars a change adds, not those there from the start', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { result, rerender } = renderHook(({ claimants }) => useClaimantPresence(claimants, 4), {
      initialProps: { claimants: [person('a'), person('b')] },
    });
    expect(entering(result.current.avatars)).toEqual([]);

    rerender({ claimants: [person('a'), person('b'), person('c')] });
    expect(entering(result.current.avatars)).toEqual(['c']);
  });

  it('animates in the avatars a removal brings out from behind the overflow count', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const five = ['a', 'b', 'c', 'd', 'e'].map(person);
    const { result, rerender } = renderHook(({ claimants }) => useClaimantPresence(claimants, 4), {
      initialProps: { claimants: five },
    });
    expect(result.current.visible.map((p) => p.id)).toEqual(['a', 'b', 'c']);

    rerender({ claimants: five.slice(1) });
    expect(entering(result.current.avatars)).toEqual(['d', 'e']);
    expect(result.current.avatars.find((avatar) => avatar.person.id === 'a')?.isExiting).toBe(true);
  });
});
