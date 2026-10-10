import type { EditableItem, Person } from '@shared/types';
import type { WizardStep } from '@features/split-workspace/types';
import { isStepValid } from './wizardValidation';

export function resolveWizardStep(
  activeStep: WizardStep,
  items: EditableItem[],
  allItems: EditableItem[],
  people: Person[],
): WizardStep {
  if (activeStep === 'final' && !isStepValid('items', { items: allItems, people })) {
    return 'items';
  }

  if (activeStep === 'items' && !isStepValid('receipt', { items, people })) {
    return 'receipt';
  }

  if (activeStep === 'receipt' && !isStepValid('people', { items, people })) {
    return 'people';
  }

  return activeStep;
}
