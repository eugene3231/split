import type { EditableItem } from '../../types'
import { parseCurrencyToCents, parseNumber } from '../core/money'

export function parseDiscountPercent(input: string): number {
  const parsed = parseNumber(input)
  if (parsed === null) {
    return 0
  }

  return Math.min(100, Math.max(0, parsed))
}

export function resolveDiscountedAmountCents(item: EditableItem): number | null {
  const grossAmountCents = parseCurrencyToCents(item.amountInput)
  if (grossAmountCents === null) {
    return null
  }

  const discountPercent = parseDiscountPercent(item.discountPercentInput)
  const discountedAmount = Math.round(grossAmountCents * (1 - discountPercent / 100))

  return Math.max(0, discountedAmount)
}
