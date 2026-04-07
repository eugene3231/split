import { LOCAL_STORAGE_SIMPLE_WIZARD_STATE_KEY } from '@shared/constants';
import type { ItemsSubPhase, SimpleWizardStep } from '@pages/types';

type PersistedSimpleWizardState = {
  version: 1;
  step: SimpleWizardStep;
  itemsSubPhase: ItemsSubPhase;
  activeItemIndex: number;
};

export function loadSimpleWizardState(): PersistedSimpleWizardState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_SIMPLE_WIZARD_STATE_KEY);
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

export function saveSimpleWizardState(state: {
  step: SimpleWizardStep;
  itemsSubPhase: ItemsSubPhase;
  activeItemIndex: number;
}): void {
  if (typeof window === 'undefined') {
    return;
  }

  const payload: PersistedSimpleWizardState = {
    version: 1,
    step: state.step,
    itemsSubPhase: state.itemsSubPhase,
    activeItemIndex: Math.max(0, Math.floor(state.activeItemIndex)),
  };

  try {
    window.localStorage.setItem(LOCAL_STORAGE_SIMPLE_WIZARD_STATE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage write failures.
  }
}

function normalizeStep(value: unknown): SimpleWizardStep {
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
