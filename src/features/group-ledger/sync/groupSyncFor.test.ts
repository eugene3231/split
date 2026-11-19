import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { setFakeOffline } from '@features/group-ledger/backend/fakeBackend';
import { newGroup } from '@features/group-ledger/backend/testing/backendContract';
import { useAccountStore } from '@features/group-ledger/sync/accountStore';
import { createGroup } from '@features/group-ledger/sync/createGroup';
import { forgetGroup, groupSyncFor } from '@features/group-ledger/sync/groupSync';
import { useJoinedGroupsStore } from '@features/group-ledger/sync/joinedGroupsStore';

beforeEach(() => {
  for (const group of useJoinedGroupsStore.getState().groups) forgetGroup(group.groupId);
  window.localStorage.clear();
  useAccountStore.setState({ session: null, emailSignIn: { step: 'idle' }, failure: null });
  setFakeOffline(false);
});

describe('groupSyncFor', () => {
  it('keeps the home list name in step with the log, which a restored group arrives without', () => {
    const groupId = createGroup({ name: 'Trip', currency: 'SGD', myName: 'Ana', friendNames: [] });
    useJoinedGroupsStore.getState().setName(groupId, '');

    act(() => {
      groupSyncFor(groupId)?.submit({ kind: 'group.renamed', name: 'Bali trip' });
    });

    expect(useJoinedGroupsStore.getState().groups[0].name).toBe('Bali trip');
  });

  it('teaches the account who this phone is from the first sync that reaches the server', async () => {
    const { groupId, inviteCode } = newGroup();
    useJoinedGroupsStore.getState().add({ groupId, inviteCode, createdHere: true, name: 'Soon' });

    groupSyncFor(groupId);

    await waitFor(() => expect(useAccountStore.getState().session).not.toBeNull());
  });
});
