import type { ChargeDetection, ChargeState } from '@shared/types'
import { parseCurrencyToCents, parseNumber } from '@shared/logic/core/money'

export function resolveChargeCents(
  charge: ChargeState,
  subtotalCents: number,
  percentageBaseCents: number,
): number {
  if (!charge.enabled) {
    return 0
  }

  if (charge.mode === 'amount') {
    return parseCurrencyToCents(charge.amountInput) ?? 0
  }

  const rate = parseNumber(charge.percentInput)
  if (rate === null) {
    return 0
  }

  const baseCents = percentageBaseCents === 0 ? subtotalCents : percentageBaseCents
  return Math.round((baseCents * rate) / 100)
}

export function applyChargeDetection(current: ChargeState, detection: ChargeDetection): ChargeState {
  const next: ChargeState = {
    ...current,
    enabled: detection.enabled,
    detectedConfidence: detection.confidence,
    detectedSource: detection.source === 'none' ? null : detection.source,
  }

  if (detection.amount !== null) {
    next.mode = 'amount'
    next.amountInput = detection.amount.toFixed(2)
  } else if (detection.percent !== null) {
    next.mode = 'percent'
    next.percentInput = detection.percent.toString()
  }

  return next
}
