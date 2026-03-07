export function toNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.trim().replace(/,/g, '')
    if (!normalized) {
      return null
    }

    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export function parseNumber(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }

  const normalized = trimmed.replace(/,/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function parseCurrencyToCents(input: string): number | null {
  const parsed = parseNumber(input)
  if (parsed === null) {
    return null
  }

  return Math.round(parsed * 100)
}

export function formatCurrencyFromCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
