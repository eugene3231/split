import { beforeEach, describe, expect, it } from 'vitest';
import { LOCAL_STORAGE_SAVED_GROUPS_KEY } from '@features/split-workspace/constants';
import {
  loadSavedGroups,
  namesMissingFromSplit,
  saveSavedGroups,
  upsertSavedGroup,
} from '@features/split-workspace/logic/savedGroups';

const housemates = { id: 'g1', name: 'Housemates', names: ['Ana', 'Ben', 'Cai'] };

describe('upsertSavedGroup', () => {
  it('adds a new group with a trimmed name', () => {
    const groups = upsertSavedGroup([], '  Colleagues ', ['Dee', 'Eli']);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ name: 'Colleagues', names: ['Dee', 'Eli'] });
  });

  it('replaces the names of a group saved under the same name, ignoring case', () => {
    const groups = upsertSavedGroup([housemates], 'housemates', ['Ana', 'Ben']);

    expect(groups).toEqual([{ id: 'g1', name: 'housemates', names: ['Ana', 'Ben'] }]);
  });

  it('ignores a blank name or an empty list of names', () => {
    expect(upsertSavedGroup([housemates], '   ', ['Ana'])).toEqual([housemates]);
    expect(upsertSavedGroup([housemates], 'Family', [])).toEqual([housemates]);
  });
});

describe('namesMissingFromSplit', () => {
  it('returns the names not yet in the split, ignoring case', () => {
    expect(namesMissingFromSplit(housemates, ['ana', 'Zoe'])).toEqual(['Ben', 'Cai']);
  });

  it('returns nothing when everyone is already in the split', () => {
    expect(namesMissingFromSplit(housemates, ['Cai', 'Ben', 'Ana'])).toEqual([]);
  });
});

describe('saved group storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('round-trips groups through localStorage', () => {
    saveSavedGroups([housemates]);

    expect(loadSavedGroups()).toEqual([housemates]);
  });

  it('drops malformed groups and blank names', () => {
    window.localStorage.setItem(
      LOCAL_STORAGE_SAVED_GROUPS_KEY,
      JSON.stringify([
        { id: 'g2', name: 'Family', names: ['Mum', '', 3] },
        { id: 'g3', name: 'Empty', names: [] },
        { name: 'No id', names: ['Ana'] },
        'nonsense',
      ]),
    );

    expect(loadSavedGroups()).toEqual([{ id: 'g2', name: 'Family', names: ['Mum'] }]);
  });

  it('returns no groups when the stored value is not valid JSON', () => {
    window.localStorage.setItem(LOCAL_STORAGE_SAVED_GROUPS_KEY, '{');

    expect(loadSavedGroups()).toEqual([]);
  });
});
