import { useEffect, useRef, useState } from 'react';
import { prefersMotion } from '@features/split-workspace/components/shared/motion';

const REMOVAL_FALLBACK_MS = 500;

export function usePersonRemoval(removePerson: (personId: string) => void) {
  const [leavingIds, setLeavingIds] = useState<string[]>([]);
  const pending = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const removals = pending.current;
    return () => {
      for (const [personId, timer] of removals) {
        clearTimeout(timer);
        removePerson(personId);
      }
      removals.clear();
    };
  }, [removePerson]);

  const finishRemoval = (personId: string) => {
    const timer = pending.current.get(personId);
    if (timer === undefined) return;
    clearTimeout(timer);
    pending.current.delete(personId);
    removePerson(personId);
    setLeavingIds((ids) => ids.filter((id) => id !== personId));
  };

  const startRemoval = (personId: string) => {
    if (pending.current.has(personId)) return;
    if (!prefersMotion()) {
      removePerson(personId);
      return;
    }
    pending.current.set(
      personId,
      setTimeout(() => finishRemoval(personId), REMOVAL_FALLBACK_MS),
    );
    setLeavingIds((ids) => [...ids, personId]);
  };

  return { leavingIds, startRemoval, finishRemoval };
}
