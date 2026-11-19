import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GroupId } from '@features/group-ledger/domain/types';
import { setFakeOffline } from '@features/group-ledger/backend/fakeBackend';
import { newGroup } from '@features/group-ledger/backend/testing/backendContract';
import { postWeights } from '@features/group-ledger/logic/post';
import { asLocalDate, newEntryId } from '@features/group-ledger/logic/ids';
import { useAccountStore } from '@features/group-ledger/sync/accountStore';
import { createGroup } from '@features/group-ledger/sync/createGroup';
import { forgetGroup } from '@features/group-ledger/sync/groupSync';
import { useJoinedGroupsStore } from '@features/group-ledger/sync/joinedGroupsStore';
import { useGroup, type GroupView, type ReadyGroup } from './useGroup';

function ready(view: GroupView): ReadyGroup {
  if (view.status !== 'ready') throw new Error(`the group is ${view.status}`);
  return view;
}

function dinner(group: ReadyGroup, cents: number) {
  const [me, ...friends] = group.ledger.members.map((member) => member.id);
  const entry = postWeights(
    {
      id: newEntryId(),
      title: 'Dinner',
      date: asLocalDate('2026-11-19'),
      currency: 'SGD',
      rate: 1,
      payment: { payer: me, others: {} },
    },
    cents,
    Object.fromEntries([me, ...friends].map((id) => [id, 1])),
  );
  if (entry === null) throw new Error('dinner did not post');
  return entry;
}

beforeEach(() => {
  for (const group of useJoinedGroupsStore.getState().groups) forgetGroup(group.groupId);
  window.localStorage.clear();
  useAccountStore.setState({ session: null, emailSignIn: { step: 'idle' }, failure: null });
  setFakeOffline(false);
});

afterEach(() => setFakeOffline(false));

describe('useGroup', () => {
  it('says a group this phone does not hold is missing', () => {
    const { result } = renderHook(() => useGroup(newGroup().groupId));

    expect(result.current).toEqual({ status: 'missing' });
  });

  it('opens a group made with no signal, with me claimed and the changes waiting', () => {
    setFakeOffline(true);
    const groupId = createGroup({
      name: 'Japan 2026',
      currency: 'SGD',
      myName: 'Ana',
      friendNames: ['Ben'],
    });

    const { result } = renderHook(() => useGroup(groupId));

    const group = ready(result.current);
    expect(group.ledger.name).toBe('Japan 2026');
    expect(group.ledger.members.map((member) => member.name)).toEqual(['Ana', 'Ben']);
    expect(group.ledger.me).toBe(group.ledger.members[0].id);
    expect(group.sync.pending).toBe(4);
  });

  it('recomputes balances and settle-up as expenses are added, removed and put back', async () => {
    const groupId = createGroup({
      name: 'Lunch',
      currency: 'SGD',
      myName: 'Ana',
      friendNames: ['Ben'],
    });
    const { result } = renderHook(() => useGroup(groupId));
    const [ana, ben] = ready(result.current).ledger.members.map((member) => member.id);
    const entry = dinner(ready(result.current), 3000);

    act(() => ready(result.current).act.addExpense(entry));
    expect(ready(result.current).balances).toEqual({ [ana]: 1500, [ben]: -1500 });
    expect(ready(result.current).transfers).toEqual([{ from: ben, to: ana, cents: 1500 }]);

    const rev = ready(result.current).ledger.entries[0].rev;
    let removedBy = rev;
    act(() => {
      removedBy = ready(result.current).act.removeEntry(entry.id, rev);
    });
    expect(ready(result.current).ledger.entries).toEqual([]);

    act(() => ready(result.current).act.editEntry(entry, removedBy));
    expect(ready(result.current).ledger.activity[0].what.kind).toBe('entry-restored');

    act(() => ready(result.current).act.markPaid(ready(result.current).transfers[0]));
    expect(ready(result.current).balances).toEqual({ [ana]: 0, [ben]: 0 });
    await waitFor(() => expect(ready(result.current).sync.pending).toBe(0));
  });

  it('keeps the home list name in step with the group, which a restored group arrives without', () => {
    const groupId: GroupId = createGroup({
      name: 'Trip',
      currency: 'SGD',
      myName: 'Ana',
      friendNames: [],
    });
    useJoinedGroupsStore.getState().setName(groupId, '');

    const { result } = renderHook(() => useGroup(groupId));
    act(() => ready(result.current).act.rename('Bali trip'));

    expect(useJoinedGroupsStore.getState().groups[0].name).toBe('Bali trip');
  });

  it('waits for a held group whose log has not arrived, and learns who this phone is', async () => {
    const { groupId, inviteCode } = newGroup();
    useJoinedGroupsStore.getState().add({ groupId, inviteCode, createdHere: true, name: 'Soon' });

    const { result } = renderHook(() => useGroup(groupId));

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(useAccountStore.getState().session).not.toBeNull());
  });
});
