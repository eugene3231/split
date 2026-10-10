import type { WizardStep } from '@features/split-workspace/types';

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
