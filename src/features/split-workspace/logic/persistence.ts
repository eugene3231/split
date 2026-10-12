import { isRecord } from './guards';
import { LOCAL_STORAGE_WIZARD_STATE_KEY } from '@features/split-workspace/constants';
import type { WizardStep } from '@features/split-workspace/types';

interface WizardState {
  step: WizardStep;
  activePersonId: string;
}

interface PersistedWizardState extends WizardState {
  version: 1;
}

export function loadWizardState(): PersistedWizardState | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_WIZARD_STATE_KEY);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1) {
      return null;
    }

    // Saves from the item-by-item assign step carry extra fields; they are ignored and the
    // person falls back to the first one.
    return {
      version: 1,
      step: normalizeStep(parsed.step),
      activePersonId: typeof parsed.activePersonId === 'string' ? parsed.activePersonId : '',
    };
  } catch {
    return null;
  }
}

export function saveWizardState(state: WizardState): void {
  const payload: PersistedWizardState = {
    version: 1,
    step: state.step,
    activePersonId: state.activePersonId,
  };

  try {
    window.localStorage.setItem(LOCAL_STORAGE_WIZARD_STATE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage write failures.
  }
}

function normalizeStep(value: unknown): WizardStep {
  return value === 'people' || value === 'receipt' || value === 'items' || value === 'final'
    ? value
    : 'people';
}
