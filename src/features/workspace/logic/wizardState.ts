import type { EditableItem, Person } from '@shared/types';
import type { ItemsSubPhase, WizardStep } from '@features/workspace/types';
import { isStepValid } from './wizardValidation';

export function clampActiveItemIndex(index: number, itemCount: number): number {
  if (itemCount <= 0) return 0;
  return Math.min(Math.max(0, index), itemCount - 1);
}

export function resolveWizardState(
  activeStep: WizardStep,
  itemsSubPhase: ItemsSubPhase,
  items: EditableItem[],
  people: Person[],
): { activeStep: WizardStep; itemsSubPhase: ItemsSubPhase } {
  if (activeStep === 'final' && !isStepValid('items', { items, people })) {
    return { activeStep: 'items', itemsSubPhase: 'assign' };
  }

  if (activeStep === 'items' && !isStepValid('receipt', { items, people })) {
    return { activeStep: 'receipt', itemsSubPhase };
  }

  if (activeStep === 'receipt' && !isStepValid('people', { items, people })) {
    return { activeStep: 'people', itemsSubPhase };
  }

  return { activeStep, itemsSubPhase };
}
