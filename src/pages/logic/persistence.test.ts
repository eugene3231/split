import { beforeEach, describe, expect, it } from 'vitest';
import { LOCAL_STORAGE_SIMPLE_WIZARD_STATE_KEY } from '@shared/constants';
import { loadSimpleWizardState, saveSimpleWizardState } from '@pages/logic/persistence';

describe('loadSimpleWizardState', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns null for malformed JSON', () => {
    window.localStorage.setItem(LOCAL_STORAGE_SIMPLE_WIZARD_STATE_KEY, '{broken');
    expect(loadSimpleWizardState()).toBeNull();
  });

  it('returns null for non-v1 version', () => {
    window.localStorage.setItem(
      LOCAL_STORAGE_SIMPLE_WIZARD_STATE_KEY,
      JSON.stringify({ version: 2, step: 'people', itemsSubPhase: 'assign', activeItemIndex: 0 }),
    );
    expect(loadSimpleWizardState()).toBeNull();
  });

  it('loads a valid v1 state', () => {
    saveSimpleWizardState({ step: 'items', itemsSubPhase: 'review', activeItemIndex: 2 });
    const state = loadSimpleWizardState();
    expect(state).toEqual({
      version: 1,
      step: 'items',
      itemsSubPhase: 'review',
      activeItemIndex: 2,
    });
  });

  it('defaults unknown step to "people"', () => {
    window.localStorage.setItem(
      LOCAL_STORAGE_SIMPLE_WIZARD_STATE_KEY,
      JSON.stringify({ version: 1, step: 'unknown', itemsSubPhase: 'assign', activeItemIndex: 0 }),
    );
    const state = loadSimpleWizardState();
    expect(state?.step).toBe('people');
  });
});
