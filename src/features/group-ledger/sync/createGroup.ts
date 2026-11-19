import type { GroupId } from '@features/group-ledger/domain/types';
import { newGroupId, newInviteCode } from '@features/group-ledger/logic/ids';
import { newGroupChanges, type NewGroup } from '@features/group-ledger/logic/newGroup';
import { groupSyncFor } from '@features/group-ledger/sync/groupSync';
import { useJoinedGroupsStore } from '@features/group-ledger/sync/joinedGroupsStore';

/**
 * Makes a group on this phone and returns its id. Everything is stored before it returns, so it
 * works with no signal; the group reaches the server on the first sync that gets through.
 */
export function createGroup(group: NewGroup): GroupId {
  const groupId = newGroupId();
  const { changes } = newGroupChanges(group);
  useJoinedGroupsStore
    .getState()
    .add({ groupId, inviteCode: newInviteCode(), createdHere: true, name: group.name.trim() });
  const engine = groupSyncFor(groupId);
  if (engine === null) throw new Error('A group just added is not held on this phone.');
  for (const change of changes) engine.submit(change);
  return groupId;
}
