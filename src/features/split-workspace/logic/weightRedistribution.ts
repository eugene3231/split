import { allocateCents } from '@shared/logic/split/split';

/**
 * Tricount-style smart fill: typing a new value for one person pulls the
 * difference out of (or gives back to) everyone else, proportional to their
 * current share — so the total always stays exactly `total` without a
 * separate remaining/over readout to reconcile by hand.
 */
export function redistributeOnChange(
  prev: Record<string, number>,
  personId: string,
  rawNewValue: number,
  total: number,
  selectedIds: string[],
): Record<string, number> {
  const others = selectedIds.filter((id) => id !== personId);
  const selfCurrent = prev[personId] ?? 0;
  const newSelf = Math.max(0, Math.min(total, rawNewValue));
  const actualDelta = newSelf - selfCurrent;
  if (actualDelta === 0) return prev;

  const currentOthersSum = others.reduce((sum, id) => sum + (prev[id] ?? 0), 0);
  const remainingForOthers = Math.max(0, currentOthersSum - actualDelta);
  const othersWeights = Object.fromEntries(others.map((id) => [id, prev[id] ?? 0]));
  const allocated = allocateCents(remainingForOthers, others, othersWeights);

  return { ...prev, [personId]: newSelf, ...allocated };
}
