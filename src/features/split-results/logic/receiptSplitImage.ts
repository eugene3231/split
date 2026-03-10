import type { ChargeState, Person, PersonReceiptLineItem, SplitResult } from '../../../shared/types'
import { formatCurrencyFromCents, parseNumber } from '../../../shared/logic/core/money'
import {
  CANVAS_WIDTH,
  SCRATCH_HEIGHT,
  getPersonCanvasColor,
  drawCardShell,
  drawTwoColumnRow,
  canvasToBlob,
  formatGeneratedAt,
  formatPercent,
} from './receiptSplitImageHelpers'

type GenerateReceiptSplitImageOptions = {
  people: Person[]
  split: SplitResult
  discount: ChargeState
  serviceCharge: ChargeState
  gst: ChargeState
  reconciliationCents: number | null
  includeLineItems: boolean
  includeItemDetails: boolean
  receiptName?: string
}

export async function generateReceiptSplitImage(options: GenerateReceiptSplitImageOptions): Promise<Blob> {
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
  context.fillText(options.receiptName || 'Receipt Splitter', x, y)
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
    discount: options.discount,
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
    const COLS = 3
    const COL_GAP = 24
    const colWidth = Math.floor((cardWidth - COL_GAP * (COLS - 1)) / COLS)

    for (let rowStart = 0; rowStart < options.people.length; rowStart += COLS) {
      const rowPeople = options.people.slice(rowStart, Math.min(rowStart + COLS, options.people.length))

      // Calculate max card height for this row so cards are aligned vertically
      let rowHeight = 0
      for (const person of rowPeople) {
        const allLines = options.split.lineItemsByPerson[person.id] ?? []
        const involvedCount = options.split.involvedCountByPerson[person.id] ?? 0
        const notInvolvedCount = allLines.length - involvedCount
        const hasDiscount = (options.split.discountByPersonCents[person.id] ?? 0) > 0
        rowHeight = Math.max(rowHeight, measurePersonCardHeight(involvedCount, notInvolvedCount, options.includeLineItems, includeItemDetails, hasDiscount))
      }

      for (let col = 0; col < rowPeople.length; col++) {
        const person = rowPeople[col]
        const allLines = options.split.lineItemsByPerson[person.id] ?? []
        drawPersonCard(context, {
          x: x + col * (colWidth + COL_GAP),
          y,
          width: colWidth,
          height: rowHeight,
          colorIndex: rowStart + col,
          personName: person.name,
          allLines,
          split: options.split,
          personId: person.id,
          includeLineItems: options.includeLineItems,
          includeItemDetails,
          discount: options.discount,
          serviceCharge: options.serviceCharge,
          gst: options.gst,
        })
      }

      y += rowHeight + 16
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

  outputContext.drawImage(scratch, 0, 0, CANVAS_WIDTH, usedHeight, 0, 0, output.width, output.height)
  return canvasToBlob(output)
}

type SummaryCardArgs = {
  x: number
  y: number
  width: number
  split: SplitResult
  discount: ChargeState
  serviceCharge: ChargeState
  gst: ChargeState
  reconciliationCents: number | null
}

function drawSummaryCard(context: CanvasRenderingContext2D, args: SummaryCardArgs): number {
  type Row = { label: string; value: string; emphasized?: boolean; valueColor?: string }

  const rows: Row[] = [
    { label: 'Subtotal', value: formatCurrencyFromCents(args.split.subtotalCents) },
  ]

  if (args.split.discountCents > 0) {
    rows.push({ label: buildChargeLabel('Whole-Bill Discount', args.discount), value: `−${formatCurrencyFromCents(args.split.discountCents)}`, valueColor: '#6ee7b7' })
  }

  rows.push(
    { label: buildChargeLabel('Service Charge', args.serviceCharge), value: formatCurrencyFromCents(args.split.serviceChargeCents) },
    { label: buildChargeLabel('GST / Tax', args.gst), value: formatCurrencyFromCents(args.split.gstCents) },
    { label: 'Total Assigned', value: formatCurrencyFromCents(args.split.grandTotalCents), emphasized: true },
  )

  if (args.reconciliationCents !== null) {
    const receiptTotalCents = args.reconciliationCents + args.split.grandTotalCents
    rows.push(
      { label: 'Receipt Total', value: formatCurrencyFromCents(receiptTotalCents) },
      { label: 'Difference', value: formatCurrencyFromCents(args.reconciliationCents), valueColor: args.reconciliationCents === 0 ? '#6ee7b7' : '#fcd34d' },
    )
  }

  const SUMMARY_HEADER_H = 76
  const height = SUMMARY_HEADER_H + 16 + rows.length * 34 + 10
  const afterY = drawCardShell(context, args.x, args.y, args.width, height)

  // Colored "Total Assigned" header (mirrors SplitTotalsCard header)
  context.fillStyle = 'rgba(14, 165, 233, 0.15)'
  context.fillRect(args.x, args.y, args.width, SUMMARY_HEADER_H)
  context.strokeStyle = 'rgba(14, 165, 233, 0.5)'
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(args.x, args.y + SUMMARY_HEADER_H)
  context.lineTo(args.x + args.width, args.y + SUMMARY_HEADER_H)
  context.stroke()

  context.fillStyle = '#f1f5f9'
  context.font = '700 18px system-ui, -apple-system, sans-serif'
  context.fillText('Total Assigned', args.x + 20, args.y + 26)

  context.fillStyle = '#7dd3fc'
  context.font = '700 28px system-ui, -apple-system, sans-serif'
  context.fillText(formatCurrencyFromCents(args.split.grandTotalCents), args.x + 20, args.y + 62)

  let rowY = args.y + SUMMARY_HEADER_H + 32
  for (const row of rows) {
    drawTwoColumnRow(context, {
      x: args.x + 20,
      y: rowY,
      width: args.width - 40,
      label: row.label,
      value: row.value,
      emphasized: row.emphasized ?? false,
      valueColor: row.valueColor ?? '#e2e8f0',
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
  height: number
  colorIndex: number
  personName: string
  allLines: PersonReceiptLineItem[]
  split: SplitResult
  personId: string
  includeLineItems: boolean
  includeItemDetails: boolean
  discount: ChargeState
  serviceCharge: ChargeState
  gst: ChargeState
}

const HEADER_HEIGHT = 104
const LINE_ROW_H = 32         // height per line item row (no details)
const LINE_TO_DETAIL_H = 20   // advance from item baseline to its detail sub-row baseline
const LINE_ROW_DETAIL_H = 26  // advance from detail sub-row baseline to next item baseline
const ITEM_GAP = 8            // extra spacing between items
const TOTAL_ROW_H = 38        // height per totals row
const BODY_TOP_PAD = 32       // gap between header and first line item
const BODY_BOTTOM_PAD = -8    // padding below last totals row
const CARD_PAD = 28           // horizontal inner padding

function measurePersonCardHeight(involvedCount: number, notInvolvedCount: number, includeLineItems: boolean, includeItemDetails: boolean, hasDiscount: boolean): number {
  const perRow = includeItemDetails ? LINE_TO_DETAIL_H + LINE_ROW_DETAIL_H + ITEM_GAP : LINE_ROW_H + ITEM_GAP
  const involvedRows = includeLineItems ? Math.max(involvedCount, 1) : 0
  const involvedHeight = includeLineItems ? involvedRows * perRow : 0
  const notInvolvedHeight = includeLineItems ? notInvolvedCount * perRow : 0
  const totalsHeight = (hasDiscount ? 5 : 4) * TOTAL_ROW_H
  const dividerHeight = includeLineItems ? 20 : 8
  return HEADER_HEIGHT + BODY_TOP_PAD + involvedHeight + notInvolvedHeight + dividerHeight + totalsHeight + BODY_BOTTOM_PAD
}

function drawPersonCard(context: CanvasRenderingContext2D, args: PersonCardArgs): void {
  const color = getPersonCanvasColor(args.colorIndex)

  // Card shell
  drawCardShell(context, args.x, args.y, args.width, args.height)

  // Colored header background
  context.fillStyle = color.headerBg
  context.fillRect(args.x, args.y, args.width, HEADER_HEIGHT)

  // Colored header bottom border
  context.strokeStyle = color.headerBorder
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(args.x, args.y + HEADER_HEIGHT)
  context.lineTo(args.x + args.width, args.y + HEADER_HEIGHT)
  context.stroke()

  // Person name
  context.fillStyle = '#f8fafc'
  context.font = '700 26px system-ui, -apple-system, sans-serif'
  context.fillText(args.personName, args.x + CARD_PAD, args.y + 38)

  // Person total (accent colored)
  const total = args.split.totalByPersonCents[args.personId] ?? 0
  context.fillStyle = color.accent
  context.font = '700 32px system-ui, -apple-system, sans-serif'
  context.fillText(formatCurrencyFromCents(total), args.x + CARD_PAD, args.y + 82)

  let rowY = args.y + HEADER_HEIGHT + BODY_TOP_PAD

  if (args.includeLineItems) {
    const involvedCount = args.split.involvedCountByPerson[args.personId] ?? 0
    if (involvedCount === 0) {
      context.fillStyle = '#94a3b8'
      context.font = '500 19px system-ui, -apple-system, sans-serif'
      context.fillText('No assigned line items yet.', args.x + CARD_PAD, rowY)
      rowY += LINE_ROW_H
    } else {
      for (const line of args.allLines) {
        if (line.involved) {
          drawTwoColumnRow(context, {
            x: args.x + CARD_PAD,
            y: rowY,
            width: args.width - CARD_PAD * 2,
            label: line.name,
            value: formatCurrencyFromCents(line.assignedAmountCents),
            emphasized: false,
            valueColor: '#f8fafc',
            size: 20,
          })
          rowY += LINE_TO_DETAIL_H

          if (args.includeItemDetails) {
            context.fillStyle = '#64748b'
            context.font = '500 16px system-ui, -apple-system, sans-serif'
            context.fillText(buildItemSubMeta(line), args.x + CARD_PAD + 12, rowY)
            rowY += LINE_ROW_DETAIL_H + ITEM_GAP
          } else {
            rowY += LINE_ROW_H - LINE_TO_DETAIL_H + ITEM_GAP
          }
        } else {
          context.globalAlpha = 0.35
          drawTwoColumnRow(context, {
            x: args.x + CARD_PAD,
            y: rowY,
            width: args.width - CARD_PAD * 2,
            label: line.name,
            value: formatCurrencyFromCents(line.grossAmountCents),
            emphasized: false,
            valueColor: '#94a3b8',
            size: 18,
            italic: true,
          })
          rowY += LINE_TO_DETAIL_H

          if (args.includeItemDetails) {
            context.fillStyle = '#94a3b8'
            context.font = 'italic 500 16px system-ui, -apple-system, sans-serif'
            context.fillText('not involved', args.x + CARD_PAD + 12, rowY)
            rowY += LINE_ROW_DETAIL_H + ITEM_GAP
          } else {
            rowY += LINE_ROW_H - LINE_TO_DETAIL_H + ITEM_GAP
          }
          context.globalAlpha = 1
        }
      }
    }

    const dividerY = rowY - ITEM_GAP
    context.strokeStyle = '#1e293b'
    context.lineWidth = 1
    context.beginPath()
    context.moveTo(args.x + CARD_PAD, dividerY)
    context.lineTo(args.x + args.width - CARD_PAD, dividerY)
    context.stroke()
    rowY = dividerY + 28
  }

  drawTwoColumnRow(context, {
    x: args.x + CARD_PAD,
    y: rowY,
    width: args.width - CARD_PAD * 2,
    label: 'Items',
    value: formatCurrencyFromCents(args.split.subtotalByPersonCents[args.personId] ?? 0),
    emphasized: false,
    valueColor: '#e2e8f0',
    size: 21,
  })
  rowY += TOTAL_ROW_H

  const discountCents = args.split.discountByPersonCents[args.personId] ?? 0
  if (discountCents > 0) {
    drawTwoColumnRow(context, {
      x: args.x + CARD_PAD,
      y: rowY,
      width: args.width - CARD_PAD * 2,
      label: buildChargeLabel('Discount', args.discount),
      value: `−${formatCurrencyFromCents(discountCents)}`,
      emphasized: false,
      valueColor: '#6ee7b7',
      size: 21,
    })
    rowY += TOTAL_ROW_H
  }

  drawTwoColumnRow(context, {
    x: args.x + CARD_PAD,
    y: rowY,
    width: args.width - CARD_PAD * 2,
    label: buildChargeLabel('Service', args.serviceCharge),
    value: formatCurrencyFromCents(args.split.serviceByPersonCents[args.personId] ?? 0),
    emphasized: false,
    valueColor: '#e2e8f0',
    size: 21,
  })
  rowY += TOTAL_ROW_H

  drawTwoColumnRow(context, {
    x: args.x + CARD_PAD,
    y: rowY,
    width: args.width - CARD_PAD * 2,
    label: buildChargeLabel('GST', args.gst),
    value: formatCurrencyFromCents(args.split.gstByPersonCents[args.personId] ?? 0),
    emphasized: false,
    valueColor: '#e2e8f0',
    size: 21,
  })
  rowY += TOTAL_ROW_H

  drawTwoColumnRow(context, {
    x: args.x + CARD_PAD,
    y: rowY,
    width: args.width - CARD_PAD * 2,
    label: 'Pay',
    value: formatCurrencyFromCents(total),
    emphasized: true,
    valueColor: '#f8fafc',
    size: 23,
  })
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

