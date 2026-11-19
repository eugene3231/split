import { z } from 'zod';
import { create } from 'zustand';
import type { GroupId, InviteCode } from '@features/group-ledger/domain/types';
import { deviceProfile } from '@features/group-ledger/backend/createBackend';
import { idSchemas } from '@features/group-ledger/logic/codec';
import { jsonStorage, lenientArray } from '@features/split-workspace/logic/jsonStorage';

export interface JoinedGroupEntry {
  groupId: GroupId;
  inviteCode: InviteCode;
  /** Made on this phone, so this phone creates it on the server rather than joining it. */
  createdHere: boolean;
  /** The group's name when last seen, for the home list. The log is where the name lives. */
  name: string;
  lastOpenedAt: string;
}

const entrySchema: z.ZodType<JoinedGroupEntry> = z.object({
  groupId: idSchemas.groupId,
  inviteCode: idSchemas.inviteCode,
  createdHere: z.boolean(),
  name: z.string(),
  lastOpenedAt: z.string(),
});

interface JoinedGroupsStore {
  groups: JoinedGroupEntry[];
  /** Adds the group. A group this phone already holds is left as it is. */
  add: (group: Omit<JoinedGroupEntry, 'lastOpenedAt'>) => void;
  setName: (groupId: GroupId, name: string) => void;
  markOpened: (groupId: GroupId) => void;
  remove: (groupId: GroupId) => void;
}

export function createJoinedGroupsStore(
  profile: string,
  now: () => string = () => new Date().toISOString(),
) {
  const storage = jsonStorage(
    'localStorage',
    `split:joined-groups:${profile}`,
    lenientArray(entrySchema),
  );

  return create<JoinedGroupsStore>((set, get) => {
    function replace(groups: JoinedGroupEntry[]) {
      storage.save(groups);
      set({ groups });
    }

    function change(groupId: GroupId, fields: Partial<JoinedGroupEntry>) {
      replace(
        get().groups.map((group) => (group.groupId === groupId ? { ...group, ...fields } : group)),
      );
    }

    return {
      groups: storage.load() ?? [],

      add: (group) => {
        if (get().groups.some((held) => held.groupId === group.groupId)) return;
        replace([...get().groups, { ...group, lastOpenedAt: now() }]);
      },

      setName: (groupId, name) => change(groupId, { name }),

      markOpened: (groupId) => change(groupId, { lastOpenedAt: now() }),

      remove: (groupId) => replace(get().groups.filter((group) => group.groupId !== groupId)),
    };
  });
}

export const useJoinedGroupsStore = createJoinedGroupsStore(deviceProfile());
