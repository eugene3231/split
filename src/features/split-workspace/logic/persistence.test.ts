import { beforeEach, describe, expect, it } from 'vitest';
import { LOCAL_STORAGE_WIZARD_STATE_KEY } from '@features/split-workspace/constants';
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
      JSON.stringify({ version: 2, step: 'people', activePersonId: 'p1' }),
    );
    expect(loadWizardState()).toBeNull();
  });

  it('loads a saved step, active person and assign mode', () => {
    saveWizardState({ step: 'items', activePersonId: 'p2', assignMode: 'item' });
    expect(loadWizardState()).toEqual({
      version: 1,
      step: 'items',
      activePersonId: 'p2',
      assignMode: 'item',
    });
  });

  it('assigns by person when a save from before the mode toggle has no mode', () => {
    window.localStorage.setItem(
      LOCAL_STORAGE_WIZARD_STATE_KEY,
      JSON.stringify({ version: 1, step: 'items', activePersonId: 'p2' }),
    );
    expect(loadWizardState()).toEqual({
      version: 1,
      step: 'items',
      activePersonId: 'p2',
      assignMode: 'person',
    });
  });

  it('keeps the step from an item-by-item save and starts on no particular person', () => {
    window.localStorage.setItem(
      LOCAL_STORAGE_WIZARD_STATE_KEY,
      JSON.stringify({ version: 1, step: 'items', itemsSubPhase: 'review', activeItemIndex: 3 }),
    );
    expect(loadWizardState()).toEqual({
      version: 1,
      step: 'items',
      activePersonId: '',
      assignMode: 'person',
    });
  });

  it('defaults an unknown step to "people" and an unknown mode to by person', () => {
    window.localStorage.setItem(
      LOCAL_STORAGE_WIZARD_STATE_KEY,
      JSON.stringify({ version: 1, step: 'unknown', activePersonId: 7, assignMode: 'sideways' }),
    );
    expect(loadWizardState()).toEqual({
      version: 1,
      step: 'people',
      activePersonId: '',
      assignMode: 'person',
    });
  });
});
