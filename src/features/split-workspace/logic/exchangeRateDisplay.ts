export function computeReverseRate(effectiveRate: number): number {
  return effectiveRate > 0 ? 1 / effectiveRate : 0;
}

export function parseRateInput(
  inputValue: string,
  editingField: 'forward' | 'reverse' | null,
): number | null {
  const parsed = parseFloat(inputValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return editingField === 'reverse' ? 1 / parsed : parsed;
}
