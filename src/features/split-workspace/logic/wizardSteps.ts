import type { WizardStep } from '@features/split-workspace/types';

export const STEP_ORDER: WizardStep[] = ['people', 'receipt', 'items', 'final'];

export function getStepNumber(step: WizardStep): number {
  return STEP_ORDER.indexOf(step) + 1;
}

export function isStepCompleted(step: WizardStep, activeStep: WizardStep): boolean {
  return STEP_ORDER.indexOf(step) < STEP_ORDER.indexOf(activeStep);
}

/** The claim step's label depends on who is claiming, so the caller passes it in. */
export function getContinueLabel(activeStep: WizardStep, claimLabel: string): string {
  if (activeStep === 'people') return 'Add receipts';
  if (activeStep === 'receipt') return 'Claim items';
  if (activeStep === 'items') return claimLabel;
  return 'Summary';
}

export const STEP_LABELS: Record<WizardStep, string> = {
  people: 'People',
  receipt: 'Receipt',
  items: 'Claim',
  final: 'Summary',
};
