import type { ChargeState, Person, Receipt, SplitResult } from '@shared/types'
import { formatCurrencyFromCents, parseNumber } from '@shared/logic/core/money'
import {
  CANVAS_WIDTH,
  SCRATCH_HEIGHT,
  canvasToBlob,
  formatGeneratedAt,
  formatPercent,
  getPersonLightColor,
  drawLightCardShell,
  drawNestedCard,
  drawAvatar,
  drawRoundedRect,
  drawLightTwoColumnRow,
} from '@features/split-results/logic/receiptSplitImageLightHelpers'

type GenerateReceiptSplitImageLightOptions = {
  people: Person[]
  split: SplitResult
  receipts?: Receipt[]
  splitByReceipt?: SplitResult[]
  discount: ChargeState
  serviceCharge: ChargeState
  gst: ChargeState
  reconciliationCents: number | null
  includeItemDetails: boolean
  receiptName?: string
  currency?: string
}

// Layout constants
const CARD_PAD = 32
const AVATAR_RADIUS = 22
const AVATAR_GAP = 16          // gap between avatar and name
const HEADER_H = 88            // height of the person card header section
const NESTED_PAD = 24          // padding inside nested card
const LINE_ROW_H = 34          // height per line item row
const RECEIPT_LABEL_H = 40     // height of receipt name row within nested card
const CHARGE_ROW_H = 34        // height per charge row
const DIVIDER_H = 22           // space around divider line
const BODY_TOP_PAD = 24        // gap between header and nested card
const NESTED_BOTTOM_PAD = 24   // padding below last charge row inside nested card
const BETWEEN_CARD_GAP = 20    // vertical gap between person cards

export async function generateReceiptSplitImageLight(
  options: GenerateReceiptSplitImageLightOptions,
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('Image export is only available in the browser.')
  }

  const scratch = document.createElement('canvas')
  scratch.width = CANVAS_WIDTH
  scratch.height = SCRATCH_HEIGHT

  const ctx = scratch.getContext('2d')
  if (!ctx) throw new Error('Unable to initialize canvas renderer.')

  // Light background
  ctx.fillStyle = '#f5f5f5'
  ctx.fillRect(0, 0, scratch.width, scratch.height)

  let y = 56
  const x = 56
  const cardWidth = CANVAS_WIDTH - x * 2

  // Title
  ctx.fillStyle = '#1c1b1f'
  ctx.font = '700 44px system-ui, -apple-system, sans-serif'
  ctx.fillText(options.receiptName || 'Receipt Splitter', x, y)
  y += 36

  ctx.fillStyle = '#49454f'
  ctx.font = '500 22px system-ui, -apple-system, sans-serif'
  ctx.fillText(`Generated ${formatGeneratedAt(new Date())}`, x, y)
  y += 40

  // Grand total card (teal gradient)
  y = drawGrandTotalCard(ctx, {
    x, y, width: cardWidth,
    split: options.split,
    currency: options.currency,
  })
  y += 32

  // Person cards — 2-column grid
  if (options.people.length === 0) {
    drawLightCardShell(ctx, x, y, cardWidth, 72)
    ctx.fillStyle = '#49454f'
    ctx.font = '500 22px system-ui, -apple-system, sans-serif'
    ctx.fillText('No people added yet.', x + CARD_PAD, y + 46)
    y += 72 + BETWEEN_CARD_GAP
  } else {
    const COLS = 2
    const COL_GAP = 24
    const colWidth = Math.floor((cardWidth - COL_GAP * (COLS - 1)) / COLS)

    for (let rowStart = 0; rowStart < options.people.length; rowStart += COLS) {
      const rowPeople = options.people.slice(rowStart, Math.min(rowStart + COLS, options.people.length))

      let rowHeight = 0
      for (const person of rowPeople) {
        rowHeight = Math.max(rowHeight, measurePersonCardHeight(
          person.id, options.split, options.receipts, options.splitByReceipt,
          options.includeItemDetails,
        ))
      }

      for (let col = 0; col < rowPeople.length; col++) {
        const person = rowPeople[col]
        drawPersonCard(ctx, {
          x: x + col * (colWidth + COL_GAP),
          y,
          width: colWidth,
          height: rowHeight,
          colorIndex: rowStart + col,
          person,
          split: options.split,
          receipts: options.receipts,
          splitByReceipt: options.splitByReceipt,
          includeLineItems: options.includeItemDetails,
          discount: options.discount,
          serviceCharge: options.serviceCharge,
          gst: options.gst,
          currency: options.currency,
        })
      }

      y += rowHeight + BETWEEN_CARD_GAP
    }
  }

  // Unassigned items warning
  if (options.split.unassignedItemCount > 0) {
    const warnH = 72
    ctx.save()
    ctx.fillStyle = '#fef3c7'
    drawRoundedRect(ctx, x, y, cardWidth, warnH, 16)
    ctx.fill()
    ctx.restore()
    ctx.fillStyle = '#92400e'
    ctx.font = '500 22px system-ui, -apple-system, sans-serif'
    ctx.fillText(
      `${options.split.unassignedItemCount} item(s) are unassigned and excluded from totals.`,
      x + CARD_PAD, y + 44,
    )
    y += warnH + BETWEEN_CARD_GAP
  }

  const requiredHeight = Math.max(240, Math.ceil(y + 56))
  if (requiredHeight > scratch.height) {
    throw new Error('Export is too large. Try with fewer items.')
  }

  const output = document.createElement('canvas')
  output.width = CANVAS_WIDTH
  output.height = requiredHeight
  const outCtx = output.getContext('2d')
  if (!outCtx) throw new Error('Unable to finalize image export.')
  outCtx.drawImage(scratch, 0, 0, CANVAS_WIDTH, requiredHeight, 0, 0, output.width, output.height)
  return canvasToBlob(output)
}

// ─── Grand total card ────────────────────────────────────────────────────────

type GrandTotalCardArgs = {
  x: number
  y: number
  width: number
  split: SplitResult
  currency?: string
}

function drawGrandTotalCard(ctx: CanvasRenderingContext2D, args: GrandTotalCardArgs): number {
  const h = 116

  ctx.save()
  const grad = ctx.createLinearGradient(args.x, args.y, args.x + args.width, args.y)
  grad.addColorStop(0, '#2d6a7f')
  grad.addColorStop(1, '#1e5068')
  ctx.fillStyle = grad
  drawRoundedRect(ctx, args.x, args.y, args.width, h, 16)
  ctx.fill()
  ctx.restore()

  ctx.fillStyle = 'rgba(255,255,255,0.70)'
  ctx.font = '700 20px system-ui, -apple-system, sans-serif'
  ctx.fillText('GRAND TOTAL', args.x + CARD_PAD, args.y + 36)

  ctx.fillStyle = '#ffffff'
  ctx.font = '600 52px system-ui, -apple-system, sans-serif'
  ctx.fillText(formatCurrencyFromCents(args.split.grandTotalCents, args.currency), args.x + CARD_PAD, args.y + 92)

  return args.y + h
}

// ─── Person card height measurement ──────────────────────────────────────────

function measureReceiptBlockHeight(
  personId: string,
  receiptSplit: SplitResult,
  includeLineItems: boolean,
): number {
  const lines = receiptSplit.lineItemsByPerson[personId] ?? []
  const discountCents = receiptSplit.discountByPersonCents[personId] ?? 0
  const chargeRows = 2 + (discountCents > 0 ? 1 : 0) // Service + GST [+ Discount]
  const detailH = includeLineItems ? lines.length * LINE_ROW_H + DIVIDER_H + chargeRows * CHARGE_ROW_H : 0
  return RECEIPT_LABEL_H + detailH
}

function measurePersonCardHeight(
  personId: string,
  split: SplitResult,
  receipts: Receipt[] | undefined,
  splitByReceipt: SplitResult[] | undefined,
  includeLineItems: boolean,
): number {
  let nestedBodyH: number

  if (receipts && splitByReceipt && receipts.length > 0) {
    let bodyH = 0
    for (let i = 0; i < receipts.length; i++) {
      const rSplit = splitByReceipt[i]
      if (!rSplit) continue
      bodyH += measureReceiptBlockHeight(personId, rSplit, includeLineItems)
    }
    nestedBodyH = bodyH
  } else {
    const lines = split.lineItemsByPerson[personId] ?? []
    const discountCents = split.discountByPersonCents[personId] ?? 0
    const chargeRows = 2 + (discountCents > 0 ? 1 : 0)
    nestedBodyH = includeLineItems
      ? lines.length * LINE_ROW_H + DIVIDER_H + chargeRows * CHARGE_ROW_H
      : 0
  }

  const nestedH = NESTED_PAD + nestedBodyH + NESTED_BOTTOM_PAD
  return CARD_PAD + HEADER_H + BODY_TOP_PAD + nestedH + CARD_PAD
}

// ─── Person card drawing ──────────────────────────────────────────────────────

type PersonCardArgs = {
  x: number
  y: number
  width: number
  height: number
  colorIndex: number
  person: Person
  split: SplitResult
  receipts?: Receipt[]
  splitByReceipt?: SplitResult[]
  includeLineItems: boolean
  discount: ChargeState
  serviceCharge: ChargeState
  gst: ChargeState
  currency?: string
}

function drawPersonCard(ctx: CanvasRenderingContext2D, args: PersonCardArgs): void {
  const color = getPersonLightColor(args.colorIndex)
  drawLightCardShell(ctx, args.x, args.y, args.width, args.height)

  const innerX = args.x + CARD_PAD
  const innerWidth = args.width - CARD_PAD * 2

  // ── Header ──────────────────────────────────────────────────────────────────
  const avatarCX = innerX + AVATAR_RADIUS
  const avatarCY = args.y + CARD_PAD + AVATAR_RADIUS
  const initial = args.person.name.trim().charAt(0).toUpperCase() || '?'
  drawAvatar(ctx, avatarCX, avatarCY, AVATAR_RADIUS, initial, color.avatarBg, color.avatarText)

  ctx.fillStyle = '#1c1b1f'
  ctx.font = '700 28px system-ui, -apple-system, sans-serif'
  ctx.fillText(args.person.name, innerX + AVATAR_RADIUS * 2 + AVATAR_GAP, args.y + CARD_PAD + 30)

  const total = args.split.totalByPersonCents[args.person.id] ?? 0
  ctx.font = '500 18px system-ui, -apple-system, sans-serif'
  ctx.fillStyle = '#49454f'
  ctx.textAlign = 'right'
  ctx.fillText('Total Due', args.x + args.width - CARD_PAD, args.y + CARD_PAD + 18)
  ctx.font = '600 32px system-ui, -apple-system, sans-serif'
  ctx.fillStyle = '#1c1b1f'
  ctx.fillText(formatCurrencyFromCents(total, args.currency), args.x + args.width - CARD_PAD, args.y + CARD_PAD + 58)
  ctx.textAlign = 'left'

  // ── Nested card ─────────────────────────────────────────────────────────────
  const nestedX = innerX
  const nestedY = args.y + CARD_PAD + HEADER_H + BODY_TOP_PAD
  const nestedW = innerWidth
  const nestedH = args.height - (CARD_PAD + HEADER_H + BODY_TOP_PAD + CARD_PAD)
  drawNestedCard(ctx, nestedX, nestedY, nestedW, nestedH)

  const niX = nestedX + NESTED_PAD
  const niW = nestedW - NESTED_PAD * 2
  let rowY = nestedY + NESTED_PAD

  if (args.receipts && args.splitByReceipt && args.receipts.length > 0) {
    // ── Per-receipt breakdown ────────────────────────────────────────────────
    for (let i = 0; i < args.receipts.length; i++) {
      const receipt = args.receipts[i]
      const rSplit = args.splitByReceipt[i]
      if (!rSplit) continue

      const personReceiptTotal = rSplit.totalByPersonCents[args.person.id] ?? 0

      // Receipt name + person total for that receipt
      drawLightTwoColumnRow(ctx, {
        x: niX, y: rowY + 26, width: niW,
        label: receipt.name || `Receipt ${i + 1}`,
        value: formatCurrencyFromCents(personReceiptTotal, receipt.currency),
        emphasized: true,
        size: 21,
      })
      rowY += RECEIPT_LABEL_H

      // Line items + charges (only when showing details)
      if (args.includeLineItems) {
        const lines = rSplit.lineItemsByPerson[args.person.id] ?? []
        for (const line of lines) {
          if (!line.involved) ctx.globalAlpha = 0.40
          drawLightTwoColumnRow(ctx, {
            x: niX + 16, y: rowY + 22, width: niW - 16,
            label: line.name,
            value: line.involved ? formatCurrencyFromCents(line.assignedAmountCents, receipt.currency) : '—',
            italic: !line.involved,
            size: 19,
          })
          if (!line.involved) ctx.globalAlpha = 1
          rowY += LINE_ROW_H
        }

        // Divider
        const divY = rowY + 2
        ctx.strokeStyle = 'rgba(202,196,208,0.40)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(niX, divY)
        ctx.lineTo(niX + niW, divY)
        ctx.stroke()
        rowY = divY + DIVIDER_H - 4

        // Charge rows
        const discountCents = rSplit.discountByPersonCents[args.person.id] ?? 0
        const serviceAmt = rSplit.serviceByPersonCents[args.person.id] ?? 0
        const gstAmt = rSplit.gstByPersonCents[args.person.id] ?? 0

        if (discountCents > 0) {
          drawLightTwoColumnRow(ctx, {
            x: niX, y: rowY + 22, width: niW,
            label: buildChargeLabel('Discount', receipt.discount),
            value: `−${formatCurrencyFromCents(discountCents, receipt.currency)}`,
            valueColor: '#16a34a', italic: true, size: 19,
          })
          rowY += CHARGE_ROW_H
        }

        drawLightTwoColumnRow(ctx, {
          x: niX, y: rowY + 22, width: niW,
          label: buildChargeLabel('Service Charge', receipt.serviceCharge),
          value: `+${formatCurrencyFromCents(serviceAmt, receipt.currency)}`,
          italic: true, size: 19,
        })
        rowY += CHARGE_ROW_H

        drawLightTwoColumnRow(ctx, {
          x: niX, y: rowY + 22, width: niW,
          label: buildChargeLabel('GST / Tax', receipt.gst),
          value: `+${formatCurrencyFromCents(gstAmt, receipt.currency)}`,
          italic: true, size: 19,
        })
        rowY += CHARGE_ROW_H
      }
    }
  } else {
    // ── Single-receipt fallback ───────────────────────────────────────────────
    if (args.includeLineItems) {
      const lines = args.split.lineItemsByPerson[args.person.id] ?? []
      for (const line of lines) {
        if (!line.involved) ctx.globalAlpha = 0.40
        drawLightTwoColumnRow(ctx, {
          x: niX + 16, y: rowY + 22, width: niW - 16,
          label: line.name,
          value: line.involved ? formatCurrencyFromCents(line.assignedAmountCents, args.currency) : '—',
          italic: !line.involved, size: 20,
        })
        if (!line.involved) ctx.globalAlpha = 1
        rowY += LINE_ROW_H
      }

      const divY = rowY + 4
      ctx.strokeStyle = 'rgba(202,196,208,0.40)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(niX, divY)
      ctx.lineTo(niX + niW, divY)
      ctx.stroke()
      rowY = divY + DIVIDER_H - 4

      const discountCents = args.split.discountByPersonCents[args.person.id] ?? 0
      const serviceAmt = args.split.serviceByPersonCents[args.person.id] ?? 0
      const gstAmt = args.split.gstByPersonCents[args.person.id] ?? 0

      if (discountCents > 0) {
        drawLightTwoColumnRow(ctx, {
          x: niX, y: rowY + 22, width: niW,
          label: buildChargeLabel('Discount', args.discount),
          value: `−${formatCurrencyFromCents(discountCents, args.currency)}`,
          valueColor: '#16a34a', italic: true, size: 20,
        })
        rowY += CHARGE_ROW_H
      }

      drawLightTwoColumnRow(ctx, {
        x: niX, y: rowY + 22, width: niW,
        label: buildChargeLabel('Service Charge', args.serviceCharge),
        value: `+${formatCurrencyFromCents(serviceAmt, args.currency)}`,
        italic: true, size: 20,
      })
      rowY += CHARGE_ROW_H

      drawLightTwoColumnRow(ctx, {
        x: niX, y: rowY + 22, width: niW,
        label: buildChargeLabel('GST / Tax', args.gst),
        value: `+${formatCurrencyFromCents(gstAmt, args.currency)}`,
        italic: true, size: 20,
      })
    }
  }
}

function buildChargeLabel(label: string, charge: ChargeState): string {
  if (!charge.enabled) return `${label} (off)`
  if (charge.mode === 'percent') {
    const parsed = parseNumber(charge.percentInput)
    if (parsed !== null) return `${label} (${formatPercent(parsed)}%)`
    return `${label} (%)`
  }
  return label
}
