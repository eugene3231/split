export const SIMPLE_WIZARD_STEPS = ['people', 'receipt', 'items', 'final'] as const

export type SimpleWizardStep = (typeof SIMPLE_WIZARD_STEPS)[number]

export type ItemsSubPhase = 'assign' | 'review'

export type WizardProgressContext = {
  detectedItemsCount: number
  activeItemIndex: number
  assignedItemCount: number
  receiptNumber: number
  totalReceipts: number
}
