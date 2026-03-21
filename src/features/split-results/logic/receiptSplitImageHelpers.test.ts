import { describe, expect, it } from 'vitest'
import {
  ellipsizeText,
  formatGeneratedAt,
  formatPercent,
  getPersonCanvasColor,
} from '@features/split-results/logic/receiptSplitImageHelpers'

function makeContext(charWidth: number): CanvasRenderingContext2D {
  return {
    measureText: (text: string) => ({ width: text.length * charWidth }),
  } as unknown as CanvasRenderingContext2D
}

describe('ellipsizeText', () => {
  it('returns text unchanged when it fits within maxWidth', () => {
    const ctx = makeContext(10)
    expect(ellipsizeText(ctx, 'Hello', 100)).toBe('Hello')
  })

  it('truncates and appends ellipsis when text exceeds maxWidth', () => {
    const ctx = makeContext(10)
    const result = ellipsizeText(ctx, 'Hello World', 60)
    expect(result).toMatch(/\.\.\.$/)
    expect(result.length).toBeLessThan('Hello World'.length + 3)
  })

  it('returns empty string with ellipsis when even one char overflows', () => {
    const ctx = makeContext(100)
    const result = ellipsizeText(ctx, 'X', 10)
    expect(result).toBe('...')
  })
})

describe('formatGeneratedAt', () => {
  it('returns a non-empty string for a given date', () => {
    const result = formatGeneratedAt(new Date('2024-06-15T10:30:00Z'))
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('includes the year in the formatted output', () => {
    const result = formatGeneratedAt(new Date('2024-01-01T00:00:00Z'))
    expect(result).toContain('2024')
  })
})

describe('formatPercent', () => {
  it('strips trailing zeros from whole numbers', () => {
    expect(formatPercent(10)).toBe('10')
    expect(formatPercent(9)).toBe('9')
  })

  it('strips trailing zeros from decimals', () => {
    expect(formatPercent(10.1)).toBe('10.1')
    expect(formatPercent(10.5)).toBe('10.5')
    expect(formatPercent(10.1)).toBe('10.1')
  })

  it('keeps significant decimal digits', () => {
    expect(formatPercent(9.99)).toBe('9.99')
  })
})

describe('getPersonCanvasColor', () => {
  it('returns an object with headerBg, headerBorder, and accent', () => {
    const color = getPersonCanvasColor(0)
    expect(color).toHaveProperty('headerBg')
    expect(color).toHaveProperty('headerBorder')
    expect(color).toHaveProperty('accent')
  })

  it('cycles through the palette for indices beyond its length', () => {
    expect(getPersonCanvasColor(0)).toEqual(getPersonCanvasColor(6))
    expect(getPersonCanvasColor(1)).toEqual(getPersonCanvasColor(7))
  })

  it('returns different colors for different indices within the palette', () => {
    expect(getPersonCanvasColor(0)).not.toEqual(getPersonCanvasColor(1))
  })
})
