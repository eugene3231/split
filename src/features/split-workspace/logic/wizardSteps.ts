import type { WizardStep } from '@features/split-workspace/types';

/** The items step's label depends on whose turn it is, so the caller passes it in. */
export function getContinueLabel(activeStep: WizardStep, claimLabel: string): string {
  if (activeStep === 'people') return 'Add receipts';
  if (activeStep === 'receipt') return 'Who had what';
  if (activeStep === 'items') return claimLabel;
  return 'Summary';
}

export const STEP_LABELS: Record<WizardStep, string> = {
  people: 'People',
  receipt: 'Receipt',
  items: 'Items',
  final: 'Summary',
};
