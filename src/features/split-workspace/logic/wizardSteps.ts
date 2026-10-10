import type { ItemsSubPhase, WizardStep } from '@features/split-workspace/types';

export function getContinueLabel(
  activeStep: WizardStep,
  itemsSubPhase: ItemsSubPhase,
  isLastAssignableItem: boolean,
): string {
  if (activeStep === 'people') return 'Add Receipts';
  if (activeStep === 'receipt') return 'Assign Items';
  if (activeStep === 'items' && itemsSubPhase === 'assign')
    return isLastAssignableItem ? 'Review Items' : 'Next Item';
  return 'Summary';
}

export const STEP_LABELS: Record<WizardStep, string> = {
  people: 'People',
  receipt: 'Receipt',
  items: 'Assign',
  final: 'Summary',
};
