import { LOCAL_STORAGE_WIZARD_STATE_KEY } from '@features/split-workspace/constants';
import type { ItemsSubPhase, WizardStep } from '@features/split-workspace/types';

type PersistedWizardState = {
  version: 1;
  step: WizardStep;
  itemsSubPhase: ItemsSubPhase;
  activeItemIndex: number;
};

export function loadWizardState(): PersistedWizardState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_WIZARD_STATE_KEY);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1) {
      return null;
    }

    const step = normalizeStep(parsed.step);
    const itemsSubPhase = normalizeItemsSubPhase(parsed.itemsSubPhase);
    const activeItemIndex =
      typeof parsed.activeItemIndex === 'number' && Number.isFinite(parsed.activeItemIndex)
        ? Math.max(0, Math.floor(parsed.activeItemIndex))
        : 0;

    return {
      version: 1,
      step,
      itemsSubPhase,
      activeItemIndex,
    };
  } catch {
    return null;
  }
}

export function saveWizardState(state: {
  step: WizardStep;
  itemsSubPhase: ItemsSubPhase;
  activeItemIndex: number;
}): void {
  if (typeof window === 'undefined') {
    return;
  }

  const payload: PersistedWizardState = {
    version: 1,
    step: state.step,
    itemsSubPhase: state.itemsSubPhase,
    activeItemIndex: Math.max(0, Math.floor(state.activeItemIndex)),
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

function normalizeItemsSubPhase(value: unknown): ItemsSubPhase {
  return value === 'review' ? 'review' : 'assign';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
