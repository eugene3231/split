function initializeCentsMap(ids: string[]): Record<string, number> {
  return Object.fromEntries(ids.map((id) => [id, 0]));
}

export function allocateCents(
  totalCents: number,
  personIds: string[],
  rawWeights: Record<string, number>,
  tiePriority: Record<string, number> = {},
): Record<string, number> {
  const allocation = initializeCentsMap(personIds);

  if (personIds.length === 0 || totalCents === 0) {
    return allocation;
  }

  const weights = personIds.map((personId) => ({
    personId,
    weight: Math.max(rawWeights[personId] ?? 0, 0),
  }));

  let totalWeight = weights.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight === 0) {
    for (const entry of weights) {
      entry.weight = 1;
    }
    totalWeight = weights.length;
  }

  const sign = totalCents < 0 ? -1 : 1;
  const absoluteCents = Math.abs(totalCents);

  const baseShares = weights.map((entry) => {
    const exactShare = (absoluteCents * entry.weight) / totalWeight;
    const floorShare = Math.floor(exactShare);

    return {
      personId: entry.personId,
      floorShare,
      fractional: exactShare - floorShare,
    };
  });

  let remainder = absoluteCents - baseShares.reduce((sum, share) => sum + share.floorShare, 0);

  baseShares.sort((a, b) => {
    if (b.fractional !== a.fractional) {
      return b.fractional - a.fractional;
    }
    const priorityDifference = (tiePriority[b.personId] ?? 0) - (tiePriority[a.personId] ?? 0);
    if (priorityDifference !== 0) {
      return priorityDifference;
    }
    return a.personId.localeCompare(b.personId);
  });

  for (let index = 0; index < baseShares.length && remainder > 0; index += 1) {
    baseShares[index].floorShare += 1;
    remainder -= 1;
  }

  for (const share of baseShares) {
    allocation[share.personId] = sign * share.floorShare;
  }

  return allocation;
}
