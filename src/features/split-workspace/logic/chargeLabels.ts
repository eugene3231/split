import { formatPercentInput, parseNumber } from '@shared/logic/core/money';
import type { ChargeState } from '@shared/types';

export function buildChargeLabel(label: string, charge: ChargeState): string {
  if (!charge.enabled) return `${label} (off)`;
  if (charge.mode === 'percent') {
    if (parseNumber(charge.percentInput) !== null) {
      return `${label} (${formatPercentInput(charge.percentInput)}%)`;
    }
    return `${label} (%)`;
  }
  return label;
}
