import { create } from 'zustand';
import {
  loadSavedGroups,
  saveSavedGroups,
  upsertSavedGroup,
  type SavedGroup,
} from '@features/split-workspace/logic/savedGroups';

interface SavedGroupsStore {
  groups: SavedGroup[];
  saveGroup: (name: string, names: string[]) => void;
  removeGroup: (groupId: string) => void;
}

export const useSavedGroupsStore = create<SavedGroupsStore>((set, get) => ({
  groups: loadSavedGroups(),

  saveGroup: (name, names) => {
    const groups = upsertSavedGroup(get().groups, name, names);
    saveSavedGroups(groups);
    set({ groups });
  },

  removeGroup: (groupId) => {
    const groups = get().groups.filter((group) => group.id !== groupId);
    saveSavedGroups(groups);
    set({ groups });
  },
}));
