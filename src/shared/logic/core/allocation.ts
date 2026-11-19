/**
 * Splits `total` across `weights` by largest remainder, so the parts always add back up to it.
 * A spare cent goes to the largest remainder, then the higher `priority`, then the lower index.
 * Weights that are not positive get nothing, unless none is positive: then everyone shares evenly.
 */
export function allocate(total: number, weights: number[], priority: number[] = []): number[] {
  if (total === 0) return weights.map(() => 0);

  let positive = weights.map((weight) => Math.max(weight, 0));
  let totalWeight = positive.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight === 0) {
    positive = weights.map(() => 1);
    totalWeight = weights.length;
  }

  const absolute = Math.abs(total);
  const exact = positive.map((weight) => (absolute * weight) / totalWeight);
  const parts = exact.map(Math.floor);
  const spare = absolute - parts.reduce((sum, part) => sum + part, 0);

  const bySpareClaim = parts
    .map((_, index) => index)
    .sort(
      (a, b) =>
        exact[b] - parts[b] - (exact[a] - parts[a]) ||
        (priority[b] ?? 0) - (priority[a] ?? 0) ||
        a - b,
    );
  for (const index of bySpareClaim.slice(0, spare)) {
    parts[index] += 1;
  }

  const sign = total < 0 ? -1 : 1;
  return parts.map((part) => sign * part);
}

/**
 * `allocate` for people: a spare cent that is still tied after `tiePriority` goes to the person
 * whose id sorts first, so the result does not depend on the order people are listed in.
 */
export function allocateCents(
  totalCents: number,
  personIds: string[],
  weights: Record<string, number>,
  tiePriority: Record<string, number> = {},
): Record<string, number> {
  const sorted = [...personIds].sort((a, b) => a.localeCompare(b));
  const cents = allocate(
    totalCents,
    sorted.map((id) => weights[id] ?? 0),
    sorted.map((id) => tiePriority[id] ?? 0),
  );
  return Object.fromEntries(personIds.map((id) => [id, cents[sorted.indexOf(id)]]));
}
