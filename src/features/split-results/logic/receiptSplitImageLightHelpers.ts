// Light-theme canvas drawing utilities for receipt split image generators.
// Reuses shared constants and utilities from the base helpers file.

import { ellipsizeText } from '@features/split-results/logic/receiptSplitImageHelpers'

export {
  CANVAS_WIDTH,
  SCRATCH_HEIGHT,
  canvasToBlob,
  formatGeneratedAt,
  formatPercent,
  ellipsizeText,
} from '@features/split-results/logic/receiptSplitImageHelpers'

// 5-color palette matching personColors.ts
const PERSON_LIGHT_COLORS = [
  { avatarBg: '#86d97a', avatarText: '#003d46', accent: '#16a34a' }, // emerald
  { avatarBg: '#89c8ef', avatarText: '#003d46', accent: '#0284c7' }, // sky
  { avatarBg: '#5ecfbe', avatarText: '#003d46', accent: '#0d9488' }, // teal
  { avatarBg: '#b4a8e8', avatarText: '#003d46', accent: '#7c3aed' }, // violet
  { avatarBg: '#f5d87a', avatarText: '#003d46', accent: '#d97706' }, // amber
]

export function getPersonLightColor(index: number) {
  return PERSON_LIGHT_COLORS[index % PERSON_LIGHT_COLORS.length]
}

export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.arcTo(x + w, y, x + w, y + radius, radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius)
  ctx.lineTo(x + radius, y + h)
  ctx.arcTo(x, y + h, x, y + h - radius, radius)
  ctx.lineTo(x, y + radius)
  ctx.arcTo(x, y, x + radius, y, radius)
  ctx.closePath()
}

/** White card with subtle shadow — like bg-surface-container-lowest rounded-2xl */
export function drawLightCardShell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): number {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.10)'
  ctx.shadowBlur = 16
  ctx.shadowOffsetY = 4
  ctx.fillStyle = '#ffffff'
  drawRoundedRect(ctx, x, y, w, h, 16)
  ctx.fill()
  ctx.restore()
  return y + h
}

/** Light gray inner card — like bg-surface-container-low rounded-xl */
export function drawNestedCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.fillStyle = '#f0f0f0'
  drawRoundedRect(ctx, x, y, w, h, 12)
  ctx.fill()
}

/** Circle avatar with centered initial letter */
export function drawAvatar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  initial: string,
  bgColor: string,
  textColor: string,
): void {
  ctx.fillStyle = bgColor
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = textColor
  ctx.font = `700 ${Math.round(radius * 0.9)}px system-ui, -apple-system, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(initial, cx, cy)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

export type LightTwoColumnRowArgs = {
  x: number
  y: number
  width: number
  label: string
  value: string
  emphasized?: boolean
  /** Override value color; defaults to `#1c1b1f` */
  valueColor?: string
  /** Override label color; defaults to `#49454f` */
  labelColor?: string
  size: number
  italic?: boolean
}

export function drawLightTwoColumnRow(
  ctx: CanvasRenderingContext2D,
  args: LightTwoColumnRowArgs,
): void {
  const style = args.italic ? 'italic ' : ''
  const weight = args.emphasized ? 700 : 600
  const valueFont = `${style}${weight} ${args.size}px system-ui, -apple-system, sans-serif`
  const labelFont = `${style}500 ${Math.max(14, args.size - 2)}px system-ui, -apple-system, sans-serif`

  ctx.font = valueFont
  const valueWidth = ctx.measureText(args.value).width
  const labelMaxWidth = Math.max(80, args.width - valueWidth - 16)

  ctx.font = labelFont
  ctx.fillStyle = args.labelColor ?? '#49454f'
  ctx.fillText(ellipsizeText(ctx, args.label, labelMaxWidth), args.x, args.y)

  ctx.font = valueFont
  ctx.fillStyle = args.valueColor ?? '#1c1b1f'
  ctx.textAlign = 'right'
  ctx.fillText(args.value, args.x + args.width, args.y)
  ctx.textAlign = 'left'
}
