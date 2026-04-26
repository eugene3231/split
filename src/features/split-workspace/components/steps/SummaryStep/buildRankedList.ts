import type { Person, SplitResult } from '@shared/types';

export function buildRankedList(
  people: Person[],
  split: SplitResult,
): Array<{ person: Person; originalIndex: number; totalCents: number }> {
  return [...people]
    .map((person, originalIndex) => ({
      person,
      originalIndex,
      totalCents: split.totalByPersonCents[person.id] ?? 0,
    }))
    .sort((a, b) => b.totalCents - a.totalCents);
}
