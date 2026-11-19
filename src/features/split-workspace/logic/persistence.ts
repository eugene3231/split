import { z } from 'zod';
import { ASSIGN_MODES, WIZARD_STEPS } from '@features/split-workspace/types';
import { jsonStorage } from './jsonStorage';

// Saves from the item-by-item assign step carry extra fields; they are ignored and the
// person falls back to the first one.
const wizardStateSchema = z.object({
  version: z.literal(1),
  step: z.enum(WIZARD_STEPS).catch('people'),
  activePersonId: z.string().catch(''),
  assignMode: z.enum(ASSIGN_MODES).catch('person'),
});

type PersistedWizardState = z.infer<typeof wizardStateSchema>;

export function loadWizardState(key: string): PersistedWizardState | null {
  return jsonStorage('localStorage', key, wizardStateSchema).load();
}

export function saveWizardState(key: string, state: Omit<PersistedWizardState, 'version'>): void {
  jsonStorage('localStorage', key, wizardStateSchema).save({ version: 1, ...state });
}
