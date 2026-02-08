import type { ChargeState, Person, PersonReceiptLineItem, SplitResult } from '../../types'
import { formatCurrencyFromCents, parseNumber } from '../core/money'

type GenerateFinalSplitImageOptions = {
  people: Person[]
  split: SplitResult
  serviceCharge: ChargeState
  gst: ChargeState
  reconciliationCents: number | null
  includeLineItems: boolean
  includeItemDetails: boolean
}

const CANVAS_WIDTH = 1080
const SCRATCH_HEIGHT = 24000

export async function generateFinalSplitImage(options: GenerateFinalSplitImageOptions): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('Image export is only available in the browser.')
  }

  const scratch = document.createElement('canvas')
  scratch.width = CANVAS_WIDTH
  scratch.height = SCRATCH_HEIGHT

  const context = scratch.getContext('2d')
  if (!context) {
    throw new Error('Unable to initialize canvas renderer.')
  }

  context.fillStyle = '#020617'
  context.fillRect(0, 0, scratch.width, scratch.height)

  const includeItemDetails = options.includeLineItems && options.includeItemDetails

  let y = 48
  const x = 48
  const cardWidth = CANVAS_WIDTH - x * 2

  context.fillStyle = '#e2e8f0'
  context.font = '700 40px system-ui, -apple-system, sans-serif'
  context.fillText('Receipt Splitter', x, y)
  y += 34

  context.fillStyle = '#94a3b8'
  context.font = '500 20px system-ui, -apple-system, sans-serif'
  context.fillText(`Generated ${formatGeneratedAt(new Date())}`, x, y)
  y += 34

  y = drawSummaryCard(context, {
    x,
    y,
    width: cardWidth,
    split: options.split,
    serviceCharge: options.serviceCharge,
    gst: options.gst,
    reconciliationCents: options.reconciliationCents,
  })

  y += 24

  if (options.people.length === 0) {
    y = drawCardShell(context, x, y, cardWidth, 78)
    context.fillStyle = '#94a3b8'
    context.font = '500 20px system-ui, -apple-system, sans-serif'
    context.fillText('No people added yet.', x + 20, y - 26)
  } else {
    for (const person of options.people) {
      const personLines = options.split.lineItemsByPerson[person.id] ?? []

      y = drawPersonCard(context, {
        x,
        y,
        width: cardWidth,
        personName: person.name,
        personLines,
        split: options.split,
        personId: person.id,
        includeLineItems: options.includeLineItems,
        includeItemDetails,
        serviceCharge: options.serviceCharge,
        gst: options.gst,
      })
      y += 16
    }
  }

  if (options.split.unassignedItemCount > 0) {
    y = drawCardShell(context, x, y, cardWidth, 76)
    context.fillStyle = '#fbbf24'
    context.font = '500 19px system-ui, -apple-system, sans-serif'
    context.fillText(
      `${options.split.unassignedItemCount} item(s) are unassigned and excluded from totals.`,
      x + 20,
      y - 30,
    )
  }

  const requiredHeight = Math.max(240, Math.ceil(y + 36))
  if (requiredHeight > scratch.height) {
    throw new Error('Export is too large. Disable line item details and try again.')
  }

  const usedHeight = requiredHeight
  const output = document.createElement('canvas')
  output.width = CANVAS_WIDTH
  output.height = usedHeight

  const outputContext = output.getContext('2d')
  if (!outputContext) {
    throw new Error('Unable to finalize image export.')
  }

  outputContext.drawImage(scratch, 0, 0, CANVAS_WIDTH, usedHeight, 0, 0, CANVAS_WIDTH, usedHeight)
  return canvasToBlob(output)
}

type SummaryCardArgs = {
  x: number
  y: number
  width: number
  split: SplitResult
  serviceCharge: ChargeState
  gst: ChargeState
  reconciliationCents: number | null
}

function drawSummaryCard(context: CanvasRenderingContext2D, args: SummaryCardArgs): number {
  const rows = [
    ['Subtotal', formatCurrencyFromCents(args.split.subtotalCents)],
    [buildChargeLabel('Service Charge', args.serviceCharge), formatCurrencyFromCents(args.split.serviceChargeCents)],
    [buildChargeLabel('GST / Tax', args.gst), formatCurrencyFromCents(args.split.gstCents)],
    ['Grand Total', formatCurrencyFromCents(args.split.grandTotalCents)],
  ]

  if (args.reconciliationCents !== null) {
    rows.push(['Receipt Difference', formatCurrencyFromCents(args.reconciliationCents)])
  }

  const height = 32 + rows.length * 34 + 10
  const afterY = drawCardShell(context, args.x, args.y, args.width, height)

  let rowY = args.y + 38
  for (let index = 0; index < rows.length; index += 1) {
    const [label, value] = rows[index]
    drawTwoColumnRow(context, {
      x: args.x + 20,
      y: rowY,
      width: args.width - 40,
      label,
      value,
      emphasized: label === 'Grand Total',
      valueColor: label === 'Receipt Difference' ? '#fbbf24' : '#e2e8f0',
      size: 22,
    })
    rowY += 34
  }

  return afterY
}

type PersonCardArgs = {
  x: number
  y: number
  width: number
  personName: string
  personLines: PersonReceiptLineItem[]
  split: SplitResult
  personId: string
  includeLineItems: boolean
  includeItemDetails: boolean
  serviceCharge: ChargeState
  gst: ChargeState
}

function drawPersonCard(context: CanvasRenderingContext2D, args: PersonCardArgs): number {
  const lineRows = args.includeLineItems ? Math.max(args.personLines.length, 1) : 0
  const lineItemHeight = args.includeLineItems
    ? lineRows * (args.includeItemDetails ? 46 : 30)
    : 0
  const totalsHeight = 4 * 34
  const dividerHeight = args.includeLineItems ? 18 : 8
  const height = 26 + 30 + lineItemHeight + dividerHeight + totalsHeight + 20

  const afterY = drawCardShell(context, args.x, args.y, args.width, height)

  context.fillStyle = '#f8fafc'
  context.font = '700 25px system-ui, -apple-system, sans-serif'
  context.fillText(args.personName, args.x + 20, args.y + 34)

  let rowY = args.y + 64

  if (args.includeLineItems) {
    if (args.personLines.length === 0) {
      context.fillStyle = '#94a3b8'
      context.font = '500 18px system-ui, -apple-system, sans-serif'
      context.fillText('No assigned line items yet.', args.x + 20, rowY)
      rowY += args.includeItemDetails ? 42 : 28
    } else {
      for (const line of args.personLines) {
        drawTwoColumnRow(context, {
          x: args.x + 20,
          y: rowY,
          width: args.width - 40,
          label: line.name,
          value: formatCurrencyFromCents(line.assignedAmountCents),
          emphasized: false,
          valueColor: '#f8fafc',
          size: 19,
        })
        rowY += 24

        if (args.includeItemDetails) {
          context.fillStyle = '#64748b'
          context.font = '500 15px system-ui, -apple-system, sans-serif'
          context.fillText(buildItemSubMeta(line), args.x + 36, rowY)
          rowY += 22
        }
      }
    }

    // Position divider closer to the end of line items and leave a clearer gap
    // before totals, so the section break reads as centered.
    const dividerY = rowY - 8
    context.strokeStyle = '#1e293b'
    context.lineWidth = 1
    context.beginPath()
    context.moveTo(args.x + 20, dividerY)
    context.lineTo(args.x + args.width - 20, dividerY)
    context.stroke()
    rowY = dividerY + 24
  }

  drawTwoColumnRow(context, {
    x: args.x + 20,
    y: rowY,
    width: args.width - 40,
    label: 'Items',
    value: formatCurrencyFromCents(args.split.subtotalByPersonCents[args.personId] ?? 0),
    emphasized: false,
    valueColor: '#e2e8f0',
    size: 22,
  })
  rowY += 34

  drawTwoColumnRow(context, {
    x: args.x + 20,
    y: rowY,
    width: args.width - 40,
    label: buildChargeLabel('Service', args.serviceCharge),
    value: formatCurrencyFromCents(args.split.serviceByPersonCents[args.personId] ?? 0),
    emphasized: false,
    valueColor: '#e2e8f0',
    size: 22,
  })
  rowY += 34

  drawTwoColumnRow(context, {
    x: args.x + 20,
    y: rowY,
    width: args.width - 40,
    label: buildChargeLabel('GST', args.gst),
    value: formatCurrencyFromCents(args.split.gstByPersonCents[args.personId] ?? 0),
    emphasized: false,
    valueColor: '#e2e8f0',
    size: 22,
  })
  rowY += 34

  drawTwoColumnRow(context, {
    x: args.x + 20,
    y: rowY,
    width: args.width - 40,
    label: 'Pay',
    value: formatCurrencyFromCents(args.split.totalByPersonCents[args.personId] ?? 0),
    emphasized: true,
    valueColor: '#f8fafc',
    size: 23,
  })

  return afterY
}

function drawCardShell(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  context.fillStyle = '#0b1220'
  context.fillRect(x, y, width, height)
  context.strokeStyle = '#1e293b'
  context.lineWidth = 2
  context.strokeRect(x, y, width, height)
  return y + height
}

type TwoColumnRowArgs = {
  x: number
  y: number
  width: number
  label: string
  value: string
  emphasized: boolean
  valueColor: string
  size: number
}

function drawTwoColumnRow(context: CanvasRenderingContext2D, args: TwoColumnRowArgs): void {
  const valueFont = `${args.emphasized ? 700 : 600} ${args.size}px system-ui, -apple-system, sans-serif`
  const labelFont = `500 ${Math.max(15, args.size - 2)}px system-ui, -apple-system, sans-serif`

  context.font = valueFont
  const valueWidth = context.measureText(args.value).width

  const valueX = args.x + args.width
  const labelMaxWidth = Math.max(80, args.width - valueWidth - 16)

  context.font = labelFont
  context.fillStyle = '#94a3b8'
  context.fillText(ellipsizeText(context, args.label, labelMaxWidth), args.x, args.y)

  context.font = valueFont
  context.fillStyle = args.valueColor
  context.textAlign = 'right'
  context.fillText(args.value, valueX, args.y)
  context.textAlign = 'left'
}

function ellipsizeText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (context.measureText(text).width <= maxWidth) {
    return text
  }

  const ellipsis = '...'
  let value = text
  while (value.length > 0 && context.measureText(`${value}${ellipsis}`).width > maxWidth) {
    value = value.slice(0, -1)
  }

  return `${value}${ellipsis}`
}

function buildChargeLabel(label: string, charge: ChargeState): string {
  if (!charge.enabled) {
    return `${label} (off)`
  }

  if (charge.mode === 'percent') {
    const parsed = parseNumber(charge.percentInput)
    if (parsed !== null) {
      return `${label} (${formatPercent(parsed)}%)`
    }

    return `${label} (%)`
  }

  return `${label} (amount)`
}

function buildItemSubMeta(line: PersonReceiptLineItem): string {
  const details: string[] = []
  if (line.discountAmountCents > 0) {
    details.push(`discount ${formatPercent(line.discountPercent)}%`)
  }
  details.push(`split among ${line.splitCount}`)
  return details.join(' • ')
}

function formatPercent(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '')
}

function formatGeneratedAt(date: Date): string {
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to encode image.'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })
}
