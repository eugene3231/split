import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFakeBackend, setFakeOffline } from '@features/group-ledger/backend/fakeBackend';
import { createLocalStorageServer } from '@features/group-ledger/backend/fakeServer';
import { createdOp, newGroup } from '@features/group-ledger/backend/testing/backendContract';
import { forgetGroup } from '@features/group-ledger/sync/groupSync';
import { useJoinedGroupsStore } from '@features/group-ledger/sync/joinedGroupsStore';
import { useJoinGroup } from './useJoinGroup';

/** A group another phone made and put on the shared fake server. */
async function groupOnServer() {
  const group = newGroup();
  const other = createFakeBackend({
    server: createLocalStorageServer(),
    profile: 'other',
    isOnline: () => true,
  });
  await other.publishGroup(group, createdOp());
  return group;
}

beforeEach(() => {
  for (const group of useJoinedGroupsStore.getState().groups) forgetGroup(group.groupId);
  window.localStorage.clear();
  setFakeOffline(false);
});

afterEach(() => setFakeOffline(false));

describe('useJoinGroup', () => {
  it('joins the group a code opens and adds it to this phone', async () => {
    const group = await groupOnServer();

    const { result } = renderHook(() => useJoinGroup(group.inviteCode));

    expect(result.current.step).toBe('joining');
    await waitFor(() => expect(result.current).toEqual({ step: 'joined', groupId: group.groupId }));
    expect(useJoinedGroupsStore.getState().groups[0]).toMatchObject({
      groupId: group.groupId,
      createdHere: false,
    });
  });

  it('opens a group this phone already holds with no signal', () => {
    setFakeOffline(true);
    const group = newGroup();
    useJoinedGroupsStore.getState().add({ ...group, createdHere: true, name: 'Lunch' });

    const { result } = renderHook(() => useJoinGroup(group.inviteCode));

    expect(result.current).toEqual({ step: 'joined', groupId: group.groupId });
  });

  it('says a code that opens nothing is a bad link', async () => {
    const { inviteCode } = newGroup();
    const { result } = renderHook(() => useJoinGroup(inviteCode));

    await waitFor(() => expect(result.current.step).toBe('bad-link'));
  });

  it('waits for a signal, then joins on retry', async () => {
    const group = await groupOnServer();
    setFakeOffline(true);
    const { result } = renderHook(() => useJoinGroup(group.inviteCode));
    await waitFor(() => expect(result.current.step).toBe('offline'));

    setFakeOffline(false);
    const state = result.current;
    act(() => {
      if (state.step === 'offline') state.retry();
    });

    await waitFor(() => expect(result.current.step).toBe('joined'));
  });
});
