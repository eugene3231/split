import { beforeEach, describe, expect, it } from 'vitest';
import { LOCAL_STORAGE_WIZARD_STATE_KEY } from '@features/workspace/constants';
import { loadWizardState, saveWizardState } from './persistence';

describe('loadWizardState', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns null for malformed JSON', () => {
    window.localStorage.setItem(LOCAL_STORAGE_WIZARD_STATE_KEY, '{broken');
    expect(loadWizardState()).toBeNull();
  });

  it('returns null for non-v1 version', () => {
    window.localStorage.setItem(
      LOCAL_STORAGE_WIZARD_STATE_KEY,
      JSON.stringify({ version: 2, step: 'people', itemsSubPhase: 'assign', activeItemIndex: 0 }),
    );
    expect(loadWizardState()).toBeNull();
  });

  it('loads a valid v1 state', () => {
    saveWizardState({ step: 'items', itemsSubPhase: 'review', activeItemIndex: 2 });
    const state = loadWizardState();
    expect(state).toEqual({
      version: 1,
      step: 'items',
      itemsSubPhase: 'review',
      activeItemIndex: 2,
    });
  });

  it('defaults unknown step to "people"', () => {
    window.localStorage.setItem(
      LOCAL_STORAGE_WIZARD_STATE_KEY,
      JSON.stringify({ version: 1, step: 'unknown', itemsSubPhase: 'assign', activeItemIndex: 0 }),
    );
    const state = loadWizardState();
    expect(state?.step).toBe('people');
  });
});
