import { parseNumber } from '@shared/logic/core/money';
import type { ChargeState } from '@shared/types';

export function buildChargeLabel(label: string, charge: ChargeState): string {
  if (!charge.enabled) return `${label} (off)`;
  if (charge.mode === 'percent') {
    const parsed = parseNumber(charge.percentInput);
    if (parsed !== null) {
      const pct = parsed.toFixed(2).replace(/\.?0+$/, '');
      return `${label} (${pct}%)`;
    }
    return `${label} (%)`;
  }
  return `${label} (amount)`;
}
