import { beforeEach, describe, expect, it } from 'vitest';
import { newGroup } from '@features/group-ledger/backend/testing/backendContract';
import { createJoinedGroupsStore } from '@features/group-ledger/sync/joinedGroupsStore';

beforeEach(() => {
  window.localStorage.clear();
});

describe('joined groups', () => {
  it('holds a group across reloads, for its own phone only', () => {
    const group = newGroup();
    const store = createJoinedGroupsStore('ana', () => '2026-11-19T10:00:00.000Z');

    store.getState().add({ ...group, createdHere: true, name: 'Japan 2026' });

    const entry = {
      ...group,
      createdHere: true,
      name: 'Japan 2026',
      lastOpenedAt: '2026-11-19T10:00:00.000Z',
    };
    expect(createJoinedGroupsStore('ana').getState().groups).toEqual([entry]);
    expect(createJoinedGroupsStore('ben').getState().groups).toEqual([]);
  });

  it('leaves a group it already holds as it is when the group is added again', () => {
    const group = newGroup();
    const store = createJoinedGroupsStore('ana');
    store.getState().add({ ...group, createdHere: true, name: 'Japan 2026' });

    store.getState().add({ ...group, createdHere: false, name: '' });

    expect(store.getState().groups).toHaveLength(1);
    expect(store.getState().groups[0]).toMatchObject({ createdHere: true, name: 'Japan 2026' });
  });

  it('caches a new name and the time a group was opened', () => {
    const group = newGroup();
    const other = newGroup();
    let clock = '2026-11-19T10:00:00.000Z';
    const store = createJoinedGroupsStore('ana', () => clock);
    store.getState().add({ ...group, createdHere: false, name: '' });
    store.getState().add({ ...other, createdHere: false, name: 'Lunch' });

    clock = '2026-11-20T08:00:00.000Z';
    store.getState().setName(group.groupId, 'Japan 2026');
    store.getState().markOpened(group.groupId);

    expect(createJoinedGroupsStore('ana').getState().groups).toEqual([
      {
        ...group,
        createdHere: false,
        name: 'Japan 2026',
        lastOpenedAt: '2026-11-20T08:00:00.000Z',
      },
      { ...other, createdHere: false, name: 'Lunch', lastOpenedAt: '2026-11-19T10:00:00.000Z' },
    ]);
  });

  it('removes a group', () => {
    const group = newGroup();
    const store = createJoinedGroupsStore('ana');
    store.getState().add({ ...group, createdHere: false, name: 'Lunch' });

    store.getState().remove(group.groupId);

    expect(createJoinedGroupsStore('ana').getState().groups).toEqual([]);
  });

  it('drops a stored entry it cannot read and keeps the rest', () => {
    const group = newGroup();
    window.localStorage.setItem(
      'split:joined-groups:ana',
      JSON.stringify([
        { groupId: 3 },
        { ...group, createdHere: false, name: 'Lunch', lastOpenedAt: '2026-11-19T10:00:00.000Z' },
      ]),
    );

    expect(
      createJoinedGroupsStore('ana')
        .getState()
        .groups.map((held) => held.name),
    ).toEqual(['Lunch']);
  });

  it('keeps a group another tab added, and shows it here too', () => {
    const fromA = newGroup();
    const fromB = newGroup();
    const tabA = createJoinedGroupsStore('ana');
    const tabB = createJoinedGroupsStore('ana');

    tabA.getState().add({ ...fromA, createdHere: true, name: 'Japan 2026' });
    window.dispatchEvent(new StorageEvent('storage', { key: 'split:joined-groups:ana' }));
    tabB.getState().add({ ...fromB, createdHere: true, name: 'Lunch' });

    const ids = (store: typeof tabA) => store.getState().groups.map((held) => held.groupId);
    expect(ids(createJoinedGroupsStore('ana'))).toEqual([fromA.groupId, fromB.groupId]);
    expect(ids(tabB)).toEqual([fromA.groupId, fromB.groupId]);
  });
});
