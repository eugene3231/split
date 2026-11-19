import { beforeEach, describe, expect, it } from 'vitest';
import type { Change, MemberId } from '@features/group-ledger/domain/types';
import { createFakeBackend, FAKE_EMAIL_CODE } from '@features/group-ledger/backend/fakeBackend';
import { createLocalStorageServer } from '@features/group-ledger/backend/fakeServer';
import type { JoinedGroup } from '@features/group-ledger/backend/port';
import { newGroup } from '@features/group-ledger/backend/testing/backendContract';
import { useAccountStore } from '@features/group-ledger/sync/accountStore';
import { openDeviceLog } from '@features/group-ledger/sync/deviceLog';
import {
  createGroupSync,
  forgetGroup,
  groupSyncFor,
  syncAllGroups,
} from '@features/group-ledger/sync/groupSync';
import { useJoinedGroupsStore } from '@features/group-ledger/sync/joinedGroupsStore';

// This tab is one phone, wired the way the app wires it: the joined-groups store, the account
// store and the engine registry over the fake server in localStorage. Other phones are extra
// backends on that same server.

const created: Change = { kind: 'group.created', name: 'Japan 2026', currency: 'SGD' };
const addMember = (name: string): Change => ({
  kind: 'member.put',
  member: { id: `m-${name}` as MemberId, name, paynowMobile: null, archived: false },
});

function otherPhone(profile: string) {
  const backend = createFakeBackend({
    server: createLocalStorageServer(),
    profile,
    isOnline: () => true,
  });
  return {
    backend,
    open: (group: JoinedGroup, createdHere: boolean) =>
      createGroupSync({
        group: { ...group, createdHere },
        backend,
        log: openDeviceLog(profile, group.groupId),
      }),
  };
}

function createGroupHere(name: string) {
  const group = newGroup();
  useJoinedGroupsStore.getState().add({ ...group, createdHere: true, name });
  const engine = groupSyncFor(group.groupId);
  if (!engine) throw new Error('The group was not held.');
  return { group, engine };
}

const kinds = (engine: { getSnapshot(): { log: { confirmed: { change: Change | null }[] } } }) =>
  engine.getSnapshot().log.confirmed.map((op) => op.change?.kind);

beforeEach(() => {
  for (const group of useJoinedGroupsStore.getState().groups) forgetGroup(group.groupId);
  window.localStorage.clear();
  useAccountStore.setState({ session: null, emailSignIn: { step: 'idle' }, failure: null });
});

describe('a group shared between phones', () => {
  it('starts one engine per group this phone holds, and none for a group it does not', () => {
    const { group, engine } = createGroupHere('Japan 2026');

    expect(groupSyncFor(group.groupId)).toBe(engine);
    expect(groupSyncFor(newGroup().groupId)).toBeNull();
  });

  it('shows a friend who joined by link what this phone wrote, and the other way round', async () => {
    const { group, engine: ana } = createGroupHere('Japan 2026');
    ana.submit(created);
    ana.submit(addMember('Ana'));
    await ana.syncNow();

    const ben = otherPhone('ben').open(group, false);
    await ben.syncNow();
    ben.submit(addMember('Ben'));
    await ben.syncNow();
    await ana.syncNow();

    expect(kinds(ana)).toEqual(['group.created', 'member.put', 'member.put']);
    expect(ana.getSnapshot().log.confirmed).toEqual(ben.getSnapshot().log.confirmed);
    ben.dispose();
  });

  it('keeps this phone in its groups, and adds the account groups, after an email sign-in', async () => {
    const old = otherPhone('old-phone');
    const fromOldPhone = newGroup();
    const oldEngine = old.open(fromOldPhone, true);
    oldEngine.submit({ kind: 'group.created', name: 'Friday lunch', currency: 'SGD' });
    await oldEngine.syncNow();
    const account = await old.backend.verifyEmailCode('ana@example.com', FAKE_EMAIL_CODE);
    oldEngine.dispose();

    const { group, engine } = createGroupHere('Japan 2026');
    engine.submit(created);
    await engine.syncNow();
    await useAccountStore.getState().load();
    const anonymous = useAccountStore.getState().session;

    await useAccountStore.getState().startEmailSignIn('ana@example.com');
    await useAccountStore.getState().verifyEmailCode(FAKE_EMAIL_CODE);
    const opId = engine.submit(addMember('Ana'));
    await engine.syncNow();

    const session = useAccountStore.getState().session;
    const written = engine.getSnapshot().log.confirmed.find((op) => op.id === opId);
    const restored = groupSyncFor(fromOldPhone.groupId);
    expect(account.ok && session?.userId === account.value.userId).toBe(true);
    expect(session?.userId).not.toBe(anonymous?.userId);
    expect(written?.userId).toBe(session?.userId);
    expect(useJoinedGroupsStore.getState().groups.map((held) => held.groupId)).toEqual([
      group.groupId,
      fromOldPhone.groupId,
    ]);
    expect(restored && kinds(restored)).toEqual(['group.created']);
  });

  it('syncs every group it holds in one call', async () => {
    const first = createGroupHere('Japan 2026');
    const second = createGroupHere('Friday lunch');
    first.engine.submit(created);
    second.engine.submit({ kind: 'group.created', name: 'Friday lunch', currency: 'SGD' });

    await syncAllGroups();

    expect(first.engine.getSnapshot().sync).toMatchObject({ state: 'idle', pending: 0 });
    expect(second.engine.getSnapshot().sync).toMatchObject({ state: 'idle', pending: 0 });
  });

  it('takes a forgotten group off this phone and leaves it on the server', async () => {
    const { group, engine } = createGroupHere('Japan 2026');
    engine.submit(created);
    await engine.syncNow();

    forgetGroup(group.groupId);

    expect(useJoinedGroupsStore.getState().groups).toEqual([]);
    expect(groupSyncFor(group.groupId)).toBeNull();
    expect(Object.keys(window.localStorage).filter((key) => key.includes(group.groupId))).toEqual(
      [],
    );
    const ben = otherPhone('ben').open(group, false);
    await ben.syncNow();
    expect(kinds(ben)).toEqual(['group.created']);
    ben.dispose();
  });
});
