import { z } from 'zod';
import { LOCAL_STORAGE_WIZARD_STATE_KEY } from '@features/split-workspace/constants';
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

const wizardStateStorage = jsonStorage(
  'localStorage',
  LOCAL_STORAGE_WIZARD_STATE_KEY,
  wizardStateSchema,
);

export function loadWizardState(): PersistedWizardState | null {
  return wizardStateStorage.load();
}

export function saveWizardState(state: Omit<PersistedWizardState, 'version'>): void {
  wizardStateStorage.save({ version: 1, ...state });
}
