/** forward reads "1 {currency} = x SGD"; reverse reads "1 SGD = x {currency}". */
export type RateDirection = 'forward' | 'reverse';

/** The direction whose number is at least 1, so rupiah reads 1 SGD = 12,650 IDR, not 0.000079. */
export function resolveReadableRateDirection(effectiveRate: number): RateDirection {
  return effectiveRate >= 1 ? 'forward' : 'reverse';
}

export function flipRateDirection(direction: RateDirection): RateDirection {
  return direction === 'forward' ? 'reverse' : 'forward';
}

export function computeReverseRate(effectiveRate: number): number {
  return effectiveRate > 0 ? 1 / effectiveRate : 0;
}

export function parseRateInput(
  inputValue: string,
  editingField: RateDirection | null,
): number | null {
  const parsed = parseFloat(inputValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return editingField === 'reverse' ? 1 / parsed : parsed;
}
