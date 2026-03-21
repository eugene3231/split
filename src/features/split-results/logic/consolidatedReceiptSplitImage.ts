import type { ChargeState, Person, Receipt, SplitResult } from '@shared/types'
import { formatCurrencyFromCents, parseNumber } from '@shared/logic/core/money'
import {
  CANVAS_WIDTH,
  SCRATCH_HEIGHT,
  getPersonCanvasColor,
  drawCardShell,
  drawTwoColumnRow,
  canvasToBlob,
  formatGeneratedAt,
  formatPercent,
} from '@features/split-results/logic/receiptSplitImageHelpers'

export type GenerateConsolidatedSplitImageOptions = {
  people: Person[]
  consolidatedSplit: SplitResult
  splitByReceipt: SplitResult[]
  receipts: Receipt[]
  title?: string
}

const HEADER_HEIGHT = 104
const BODY_TOP_PAD = 32
const CARD_PAD = 28
const RECEIPT_ROW_H = 36
const ITEM_ROW_H = 30
const CHARGE_ROW_H = 34
const DIVIDER_H = 20
const RECEIPT_BOTTOM_GAP = 16

function buildChargeLabel(label: string, charge: ChargeState): string {
  if (!charge.enabled) return `${label} (off)`
  if (charge.mode === 'percent') {
    const parsed = parseNumber(charge.percentInput)
    return parsed !== null ? `${label} (${formatPercent(parsed)}%)` : `${label} (%)`
  }
  return `${label} (amount)`
}

function measurePersonCardHeight(personId: string, splitByReceipt: SplitResult[], receipts: Receipt[]): number {
  let bodyHeight = 0
  for (let i = 0; i < receipts.length; i++) {
    const receiptSplit = splitByReceipt[i]
    const personTotal = receiptSplit?.totalByPersonCents[personId] ?? 0
    if (personTotal === 0) continue
    const lineItems = receiptSplit?.lineItemsByPerson[personId] ?? []
    const hasDiscount = (receiptSplit?.discountByPersonCents[personId] ?? 0) > 0
    const chargeRows = 3 + (hasDiscount ? 1 : 0) // Items, [Discount], Service, GST
    bodyHeight += RECEIPT_ROW_H + lineItems.length * ITEM_ROW_H + DIVIDER_H + chargeRows * CHARGE_ROW_H + RECEIPT_BOTTOM_GAP
  }
  return HEADER_HEIGHT + BODY_TOP_PAD + Math.max(bodyHeight, RECEIPT_ROW_H) + 16
}

function drawGrandTotalCard(
  context: CanvasRenderingContext2D,
  args: {
    x: number
    y: number
    width: number
    consolidatedSplit: SplitResult
    splitByReceipt: SplitResult[]
    receipts: Receipt[]
  },
): number {
  const CARD_HEADER_H = 76
  const height = CARD_HEADER_H + 16 + args.receipts.length * 34 + 16
  const afterY = drawCardShell(context, args.x, args.y, args.width, height)

  context.fillStyle = 'rgba(14, 165, 233, 0.15)'
  context.fillRect(args.x, args.y, args.width, CARD_HEADER_H)
  context.strokeStyle = 'rgba(14, 165, 233, 0.5)'
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(args.x, args.y + CARD_HEADER_H)
  context.lineTo(args.x + args.width, args.y + CARD_HEADER_H)
  context.stroke()

  context.fillStyle = '#f1f5f9'
  context.font = '700 18px system-ui, -apple-system, sans-serif'
  context.fillText('Grand Total', args.x + 20, args.y + 26)

  context.fillStyle = '#7dd3fc'
  context.font = '700 28px system-ui, -apple-system, sans-serif'
  context.fillText(formatCurrencyFromCents(args.consolidatedSplit.grandTotalCents), args.x + 20, args.y + 62)

  let rowY = args.y + CARD_HEADER_H + 32
  for (let i = 0; i < args.receipts.length; i++) {
    const receipt = args.receipts[i]
    const receiptSplit = args.splitByReceipt[i]
    drawTwoColumnRow(context, {
      x: args.x + 20,
      y: rowY,
      width: args.width - 40,
      label: receipt.name || `Receipt ${i + 1}`,
      value: formatCurrencyFromCents(receiptSplit?.grandTotalCents ?? 0),
      emphasized: false,
      valueColor: '#cbd5e1',
      size: 20,
    })
    rowY += 34
  }

  return afterY
}

function drawPersonCard(
  context: CanvasRenderingContext2D,
  args: {
    x: number
    y: number
    width: number
    height: number
    colorIndex: number
    person: Person
    consolidatedSplit: SplitResult
    splitByReceipt: SplitResult[]
    receipts: Receipt[]
  },
): void {
  const color = getPersonCanvasColor(args.colorIndex)
  drawCardShell(context, args.x, args.y, args.width, args.height)

  context.fillStyle = color.headerBg
  context.fillRect(args.x, args.y, args.width, HEADER_HEIGHT)

  context.strokeStyle = color.headerBorder
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(args.x, args.y + HEADER_HEIGHT)
  context.lineTo(args.x + args.width, args.y + HEADER_HEIGHT)
  context.stroke()

  const total = args.consolidatedSplit.totalByPersonCents[args.person.id] ?? 0
  context.fillStyle = '#f8fafc'
  context.font = '700 26px system-ui, -apple-system, sans-serif'
  context.fillText(args.person.name, args.x + CARD_PAD, args.y + 38)

  context.fillStyle = color.accent
  context.font = '700 32px system-ui, -apple-system, sans-serif'
  context.fillText(formatCurrencyFromCents(total), args.x + CARD_PAD, args.y + 82)

  let rowY = args.y + HEADER_HEIGHT + BODY_TOP_PAD

  for (let i = 0; i < args.receipts.length; i++) {
    const receipt = args.receipts[i]
    const receiptSplit = args.splitByReceipt[i]
    const personTotal = receiptSplit?.totalByPersonCents[args.person.id] ?? 0
    if (personTotal === 0) continue

    const lineItems = receiptSplit?.lineItemsByPerson[args.person.id] ?? []

    drawTwoColumnRow(context, {
      x: args.x + CARD_PAD,
      y: rowY,
      width: args.width - CARD_PAD * 2,
      label: receipt.name || `Receipt ${i + 1}`,
      value: formatCurrencyFromCents(personTotal),
      emphasized: false,
      valueColor: '#cbd5e1',
      size: 21,
    })
    rowY += RECEIPT_ROW_H

    for (const line of lineItems) {
      if (!line.involved) context.globalAlpha = 0.35
      drawTwoColumnRow(context, {
        x: args.x + CARD_PAD + 16,
        y: rowY,
        width: args.width - CARD_PAD * 2 - 16,
        label: line.name,
        value: formatCurrencyFromCents(line.involved ? line.assignedAmountCents : line.grossAmountCents),
        emphasized: false,
        valueColor: line.involved ? '#f8fafc' : '#94a3b8',
        size: 19,
        italic: !line.involved,
      })
      if (!line.involved) context.globalAlpha = 1
      rowY += ITEM_ROW_H
    }

    // Divider before charge rows — trim the trailing item gap so the line sits
    // at the natural end of the last item, then advance 28px to Items row.
    const dividerY = rowY - 8
    context.strokeStyle = '#1e293b'
    context.lineWidth = 1
    context.beginPath()
    context.moveTo(args.x + CARD_PAD, dividerY)
    context.lineTo(args.x + args.width - CARD_PAD, dividerY)
    context.stroke()
    rowY = dividerY + 28

    const innerX = args.x + CARD_PAD + 16
    const innerWidth = args.width - CARD_PAD * 2 - 16

    drawTwoColumnRow(context, {
      x: innerX, y: rowY, width: innerWidth,
      label: 'Items', value: formatCurrencyFromCents(receiptSplit?.subtotalByPersonCents[args.person.id] ?? 0),
      emphasized: false, valueColor: '#e2e8f0', size: 19,
    })
    rowY += CHARGE_ROW_H

    const discountCents = receiptSplit?.discountByPersonCents[args.person.id] ?? 0
    if (discountCents > 0) {
      drawTwoColumnRow(context, {
        x: innerX, y: rowY, width: innerWidth,
        label: buildChargeLabel('Discount', receipt.discount),
        value: `−${formatCurrencyFromCents(discountCents)}`,
        emphasized: false, valueColor: '#6ee7b7', size: 19,
      })
      rowY += CHARGE_ROW_H
    }

    drawTwoColumnRow(context, {
      x: innerX, y: rowY, width: innerWidth,
      label: buildChargeLabel('Service', receipt.serviceCharge),
      value: formatCurrencyFromCents(receiptSplit?.serviceByPersonCents[args.person.id] ?? 0),
      emphasized: false, valueColor: '#e2e8f0', size: 19,
    })
    rowY += CHARGE_ROW_H

    drawTwoColumnRow(context, {
      x: innerX, y: rowY, width: innerWidth,
      label: buildChargeLabel('GST', receipt.gst),
      value: formatCurrencyFromCents(receiptSplit?.gstByPersonCents[args.person.id] ?? 0),
      emphasized: false, valueColor: '#e2e8f0', size: 19,
    })
    rowY += CHARGE_ROW_H

    rowY += RECEIPT_BOTTOM_GAP
  }
}

export async function generateConsolidatedSplitImage(options: GenerateConsolidatedSplitImageOptions): Promise<Blob> {
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

  let y = 48
  const x = 48
  const cardWidth = CANVAS_WIDTH - x * 2

  context.fillStyle = '#e2e8f0'
  context.font = '700 40px system-ui, -apple-system, sans-serif'
  context.fillText(options.title || 'Split Summary', x, y)
  y += 34

  context.fillStyle = '#94a3b8'
  context.font = '500 20px system-ui, -apple-system, sans-serif'
  context.fillText(`Generated ${formatGeneratedAt(new Date())}`, x, y)
  y += 34

  y = drawGrandTotalCard(context, {
    x,
    y,
    width: cardWidth,
    consolidatedSplit: options.consolidatedSplit,
    splitByReceipt: options.splitByReceipt,
    receipts: options.receipts,
  })

  y += 24

  if (options.people.length > 0) {
    const COLS = 3
    const COL_GAP = 24
    const colWidth = Math.floor((cardWidth - COL_GAP * (COLS - 1)) / COLS)

    for (let rowStart = 0; rowStart < options.people.length; rowStart += COLS) {
      const rowPeople = options.people.slice(rowStart, Math.min(rowStart + COLS, options.people.length))

      let rowHeight = 0
      for (const person of rowPeople) {
        rowHeight = Math.max(rowHeight, measurePersonCardHeight(person.id, options.splitByReceipt, options.receipts))
      }

      for (let col = 0; col < rowPeople.length; col++) {
        drawPersonCard(context, {
          x: x + col * (colWidth + COL_GAP),
          y,
          width: colWidth,
          height: rowHeight,
          colorIndex: rowStart + col,
          person: rowPeople[col],
          consolidatedSplit: options.consolidatedSplit,
          splitByReceipt: options.splitByReceipt,
          receipts: options.receipts,
        })
      }

      y += rowHeight + 16
    }
  }

  if (options.consolidatedSplit.unassignedItemCount > 0) {
    const warningH = 76
    drawCardShell(context, x, y, cardWidth, warningH)
    context.fillStyle = '#fbbf24'
    context.font = '500 19px system-ui, -apple-system, sans-serif'
    context.fillText(
      `${options.consolidatedSplit.unassignedItemCount} item(s) are unassigned and excluded from totals.`,
      x + 20,
      y + warningH - 30,
    )
    y += warningH
  }

  const requiredHeight = Math.max(240, Math.ceil(y + 36))
  if (requiredHeight > scratch.height) {
    throw new Error('Export is too large.')
  }

  const output = document.createElement('canvas')
  output.width = CANVAS_WIDTH
  output.height = requiredHeight

  const outputContext = output.getContext('2d')
  if (!outputContext) {
    throw new Error('Unable to finalize image export.')
  }

  outputContext.drawImage(scratch, 0, 0, CANVAS_WIDTH, requiredHeight, 0, 0, output.width, output.height)
  return canvasToBlob(output)
}
