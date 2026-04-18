import type { ItemsSubPhase, SimpleWizardStep } from '@pages/types';

export const STEP_ORDER: SimpleWizardStep[] = ['people', 'receipt', 'items', 'final'];

export function getStepNumber(step: SimpleWizardStep): number {
  return STEP_ORDER.indexOf(step) + 1;
}

export function isStepCompleted(step: SimpleWizardStep, activeStep: SimpleWizardStep): boolean {
  return STEP_ORDER.indexOf(step) < STEP_ORDER.indexOf(activeStep);
}

export function getContinueLabel(
  activeStep: SimpleWizardStep,
  itemsSubPhase: ItemsSubPhase,
  isLastAssignableItem: boolean,
): string {
  if (activeStep === 'people') return 'Add Receipts';
  if (activeStep === 'receipt') return 'Assign Items';
  if (activeStep === 'items' && itemsSubPhase === 'assign')
    return isLastAssignableItem ? 'Review Items' : 'Next Item';
  return 'Summary';
}

export const STEP_LABELS: Record<SimpleWizardStep, string> = {
  people: 'People',
  receipt: 'Receipt',
  items: 'Assign',
  final: 'Summary',
};
