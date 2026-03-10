export type AssignmentMode = 'single' | 'equal'
export type ChargeMode = 'amount' | 'percent'

export type Person = {
  id: string
  name: string
}

export type ItemAssignment = {
  mode: AssignmentMode
  personId: string
  personIds: string[]
}

export type EditableItem = {
  id: string
  name: string
  amountInput: string
  discountPercentInput: string
  assignment: ItemAssignment
}

export type ChargeState = {
  enabled: boolean
  mode: ChargeMode
  amountInput: string
  percentInput: string
  detectedConfidence: number | null
  detectedSource: string | null
}

export type ChargeDetection = {
  enabled: boolean
  amount: number | null
  percent: number | null
  confidence: number | null
  source: string
}

export type OcrResponse = {
  items: Array<{ description: string; amount: number }>
  subtotal: number | null
  total: number | null
  detected: {
    gst: ChargeDetection
    serviceCharge: ChargeDetection
  }
  warnings: string[]
}

export type SplitResult = {
  lineItemsByPerson: Record<string, PersonReceiptLineItem[]>
  involvedCountByPerson: Record<string, number>
  subtotalByPersonCents: Record<string, number>
  discountByPersonCents: Record<string, number>
  serviceByPersonCents: Record<string, number>
  gstByPersonCents: Record<string, number>
  totalByPersonCents: Record<string, number>
  subtotalCents: number
  discountCents: number
  serviceChargeCents: number
  gstCents: number
  grandTotalCents: number
  unassignedItemCount: number
}

export type ResolvedItem = {
  itemId: string
  name: string
  grossAmountCents: number
  discountPercent: number
  discountAmountCents: number
  assignedPersonIds: Set<string>
  netByPerson: Record<string, number>
  grossByPerson: Record<string, number>
}

export type PersonReceiptLineItem = {
  itemId: string
  name: string
  grossAmountCents: number
  discountPercent: number
  discountAmountCents: number
  netAmountCents: number
  assignedAmountCents: number
  splitCount: number
  involved: boolean
}

export type Receipt = {
  id: string
  name: string
  items: EditableItem[]
  discount: ChargeState
  serviceCharge: ChargeState
  gst: ChargeState
  receiptTotalInput: string
  receiptFile?: File | null
}

export type PersistedFinalSplit = {
  subtotalCents: number
  serviceChargeCents: number
  gstCents: number
  grandTotalCents: number
  totalByPersonCents: Record<string, number>
}

export type PersistedDraft = {
  version: 1
  people: Person[]
  items: EditableItem[]
  discount: ChargeState
  serviceCharge: ChargeState
  gst: ChargeState
  receiptTotalInput: string
  finalSplit: PersistedFinalSplit
  savedAt: string
}

export type SessionDraft = {
  version: 2
  people: Person[]
  receipts: Receipt[]
  activeReceiptId: string
  savedAt: string
}

export type PersistedOcrSettings = {
  version: 1
  geminiModel: string
  savedAt: string
}
