export const WIZARD_STEPS = ['people', 'receipt', 'items', 'final'] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

export type ItemsSubPhase = 'assign' | 'review';

export type WizardProgressContext = {
  detectedItemsCount: number;
  activeItemIndex: number;
  assignedItemCount: number;
  receiptNumber: number;
  totalReceipts: number;
};
