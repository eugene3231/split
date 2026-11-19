import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Change, ConfirmedOp, MemberId } from '@features/group-ledger/domain/types';
import { createFakeBackend, FAKE_EMAIL_CODE } from '@features/group-ledger/backend/fakeBackend';
import { createMemoryServer, type FakeServer } from '@features/group-ledger/backend/fakeServer';
import type { JoinedGroup, LedgerBackend } from '@features/group-ledger/backend/port';
import {
  createdOp,
  newGroup,
  pendingOp,
} from '@features/group-ledger/backend/testing/backendContract';
import { openDeviceLog } from '@features/group-ledger/sync/deviceLog';
import { createGroupSync, type GroupSync } from '@features/group-ledger/sync/groupSync';

const rename = (name: string): Change => ({ kind: 'group.renamed', name });
const addMember = (name: string): Change => ({
  kind: 'member.put',
  member: { id: `m-${name}` as MemberId, name, paynowMobile: null, archived: false },
});

const engines: GroupSync[] = [];

/** One phone: its own profile, user and signal. `open` is the app opening a group. */
function phone(server: FakeServer, profile: string, wrap = (backend: LedgerBackend) => backend) {
  const signal = { online: true };
  const backend = wrap(createFakeBackend({ server, profile, isOnline: () => signal.online }));
  return {
    signal,
    backend,
    open(group: JoinedGroup, createdHere: boolean) {
      const engine = createGroupSync({
        group: { ...group, createdHere },
        backend,
        log: openDeviceLog(profile, group.groupId),
      });
      engines.push(engine);
      return engine;
    },
  };
}

const names = (ops: readonly ConfirmedOp[]) =>
  ops.map((op) => (op.change?.kind === 'group.renamed' ? op.change.name : op.change?.kind));

/** Everything the server holds for the group, read by someone who has joined it. */
async function serverLog(server: FakeServer, group: JoinedGroup) {
  const reader = createFakeBackend({ server, profile: 'reader', isOnline: () => true });
  await reader.joinGroup(group.inviteCode);
  const pulled = await reader.pull(group.groupId, 0);
  if (!pulled.ok) throw new Error('The reader could not pull.');
  return pulled.value.ops;
}

/** A group someone else made earlier: on the server, with its `group.created` at seq 1. */
async function foundedGroup(server: FakeServer): Promise<JoinedGroup> {
  const group = newGroup();
  const founder = createFakeBackend({ server, profile: 'founder', isOnline: () => true });
  await founder.publishGroup(group, createdOp());
  return group;
}

/** What a log holds after the op that created the group. */
const sinceFounded = <Op>(ops: readonly Op[]) => ops.slice(1);

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  for (const engine of engines.splice(0)) engine.dispose();
  vi.useRealTimers();
});

describe('group sync', () => {
  it('shows a change at once as pending, then confirmed after one sync', async () => {
    const server = createMemoryServer();
    const ana = phone(server, 'ana').open(await foundedGroup(server), false);

    const opId = ana.submit(rename('Japan 2026'));
    const before = ana.getSnapshot();
    await ana.syncNow();
    const after = ana.getSnapshot();

    expect(before.log.pending.map((op) => op.id)).toEqual([opId]);
    expect(before.sync.pending).toBe(1);
    expect(after.log.pending).toEqual([]);
    expect(sinceFounded(after.log.confirmed).map((op) => [op.seq, op.id])).toEqual([[2, opId]]);
    expect(after.sync).toMatchObject({ state: 'idle', pending: 0, rejected: [] });
    expect(after.sync.lastSyncedAt).not.toBeNull();
  });

  it('hands back the same snapshot until something changes, and tells its listeners when it does', async () => {
    const ana = phone(createMemoryServer(), 'ana').open(newGroup(), true);
    await ana.syncNow();
    const listener = vi.fn();
    const stop = ana.subscribe(listener);

    const first = ana.getSnapshot();
    const second = ana.getSnapshot();
    ana.submit(rename('Japan'));
    const third = ana.getSnapshot();
    stop();
    const callsWhenStopped = listener.mock.calls.length;
    await ana.syncNow();

    expect(second).toBe(first);
    expect(third).not.toBe(first);
    expect(callsWhenStopped).toBeGreaterThan(0);
    expect(listener).toHaveBeenCalledTimes(callsWhenStopped);
  });

  it('brings two phones that both edited offline to the same confirmed log', async () => {
    const server = createMemoryServer();
    const group = newGroup();
    const anaPhone = phone(server, 'ana');
    const benPhone = phone(server, 'ben');
    const ana = anaPhone.open(group, true);
    ana.submit({ kind: 'group.created', name: 'Japan 2026', currency: 'SGD' });
    await ana.syncNow();
    const ben = benPhone.open(group, false);
    await ben.syncNow();

    anaPhone.signal.online = false;
    benPhone.signal.online = false;
    ana.submit(addMember('Ana'));
    ana.submit(rename('Japan, by Ana'));
    ben.submit(addMember('Ben'));
    ben.submit(rename('Japan, by Ben'));
    await ana.syncNow();
    await ben.syncNow();
    const offline = [ana.getSnapshot().sync, ben.getSnapshot().sync];

    anaPhone.signal.online = true;
    benPhone.signal.online = true;
    await ben.syncNow();
    await ana.syncNow();
    await ben.syncNow();

    expect(offline.map((sync) => [sync.state, sync.pending])).toEqual([
      ['offline', 2],
      ['offline', 2],
    ]);
    expect(ana.getSnapshot().log.confirmed).toEqual(ben.getSnapshot().log.confirmed);
    expect(ana.getSnapshot().log.confirmed.map((op) => op.seq)).toEqual([1, 2, 3, 4, 5]);
    expect(names(ana.getSnapshot().log.confirmed)).toEqual([
      'group.created',
      'member.put',
      'Japan, by Ben',
      'member.put',
      'Japan, by Ana',
    ]);
    expect(ana.getSnapshot().log.pending).toEqual([]);
    expect(ben.getSnapshot().log.pending).toEqual([]);
    expect(await serverLog(server, group)).toEqual(ana.getSnapshot().log.confirmed);
  });

  it('pushes again after a crash between push and confirm, without a duplicate', async () => {
    const server = createMemoryServer();
    const group = await foundedGroup(server);
    // The push reaches the server, then the tab dies before the pull that would confirm it.
    const dying = phone(server, 'ana', (backend) => ({
      ...backend,
      pull: () => new Promise(() => {}),
    }));
    const beforeCrash = dying.open(group, false);
    const opId = beforeCrash.submit(rename('Japan 2026'));
    await vi.waitFor(async () => expect(await serverLog(server, group)).toHaveLength(2));
    beforeCrash.dispose();

    const afterCrash = phone(server, 'ana').open(group, false);
    const restored = afterCrash.getSnapshot();
    await afterCrash.syncNow();

    expect(restored.log.pending.map((op) => op.id)).toEqual([opId]);
    expect(afterCrash.getSnapshot().log.pending).toEqual([]);
    expect(
      sinceFounded(afterCrash.getSnapshot().log.confirmed).map((op) => [op.seq, op.id]),
    ).toEqual([[2, opId]]);
    expect(sinceFounded(await serverLog(server, group)).map((op) => op.id)).toEqual([opId]);
  });

  it('stores an op once when the reply to its push is lost and it is pushed again', async () => {
    const server = createMemoryServer();
    const group = await foundedGroup(server);
    let lostReplies = 2;
    const ana = phone(server, 'ana', (backend) => ({
      ...backend,
      async push(groupId, ops) {
        const reply = await backend.push(groupId, ops);
        if (lostReplies === 0) return reply;
        lostReplies -= 1;
        return { ok: false, failure: { kind: 'offline' } };
      },
    })).open(group, false);

    const opId = ana.submit(rename('Japan 2026'));
    await ana.syncNow();
    const afterFirstTry = ana.getSnapshot().sync;
    await ana.syncNow();
    await ana.syncNow();

    expect(afterFirstTry).toMatchObject({ state: 'offline', pending: 1 });
    expect(ana.getSnapshot().sync).toMatchObject({ state: 'idle', pending: 0 });
    expect(sinceFounded(await serverLog(server, group)).map((op) => op.id)).toEqual([opId]);
  });

  it('drops a change the server will never take and syncs the ones behind it', async () => {
    const server = createMemoryServer();
    const ana = phone(server, 'ana').open(await foundedGroup(server), false);

    const tooBig = ana.submit(rename('x'.repeat(70_000)));
    const fine = ana.submit(rename('Japan'));
    await ana.syncNow();

    expect(ana.getSnapshot().sync).toMatchObject({ state: 'idle', pending: 0, rejected: [tooBig] });
    expect(sinceFounded(ana.getSnapshot().log.confirmed).map((op) => [op.seq, op.id])).toEqual([
      [2, fine],
    ]);
  });

  it('keeps a change on screen as pending, without syncing in a loop, when the log cannot be stored', async () => {
    const server = createMemoryServer();
    const group = await foundedGroup(server);
    const ana = phone(server, 'ana').open(group, false);
    await ana.syncNow();
    const setItem = Storage.prototype.setItem;
    const full = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key.endsWith(':confirmed')) throw new DOMException('full', 'QuotaExceededError');
      setItem.call(this, key, value);
    });

    const opId = ana.submit(rename('Japan'));
    await ana.syncNow();
    await ana.syncNow();
    full.mockRestore();

    expect(ana.getSnapshot().log.pending.map((op) => op.id)).toEqual([opId]);
    expect(ana.getSnapshot().sync.state).toBe('idle');
    expect(sinceFounded(await serverLog(server, group)).map((op) => op.id)).toEqual([opId]);
  });

  it('pushes a long outbox in batches of 50 and pulls it back in order', async () => {
    const server = createMemoryServer();
    const group = await foundedGroup(server);
    const batches: number[] = [];
    const anaPhone = phone(server, 'ana', (backend) => ({
      ...backend,
      push(groupId, ops) {
        batches.push(ops.length);
        return backend.push(groupId, ops);
      },
    }));
    anaPhone.signal.online = false;
    const ana = anaPhone.open(group, false);
    const ids = Array.from({ length: 120 }, (_, index) => ana.submit(rename(`name ${index}`)));
    await ana.syncNow();

    anaPhone.signal.online = true;
    await ana.syncNow();

    expect(batches).toEqual([50, 50, 20]);
    expect(sinceFounded(ana.getSnapshot().log.confirmed).map((op) => op.id)).toEqual(ids);
    expect(ana.getSnapshot().sync.pending).toBe(0);
  });

  it('sends changes submitted in one go as one batch', async () => {
    const batches: number[] = [];
    const ana = phone(createMemoryServer(), 'ana', (backend) => ({
      ...backend,
      push(groupId, ops) {
        batches.push(ops.length);
        return backend.push(groupId, ops);
      },
    })).open(newGroup(), true);
    await ana.syncNow();

    ana.submit({ kind: 'group.created', name: 'Japan 2026', currency: 'SGD' });
    ana.submit(addMember('Ana'));
    ana.submit(rename('Japan'));
    await ana.syncNow();

    expect(batches).toEqual([3]);
  });

  it('syncs a change submitted while a sync is running, in the same call', async () => {
    const server = createMemoryServer();
    const group = await foundedGroup(server);
    const ana = phone(server, 'ana').open(group, false);

    const first = ana.submit(rename('one'));
    const running = ana.syncNow();
    await Promise.resolve();
    await Promise.resolve();
    const second = ana.submit(rename('two'));
    const joined = ana.syncNow();
    await running;

    expect(joined).toBe(running);
    expect(sinceFounded(ana.getSnapshot().log.confirmed).map((op) => op.id)).toEqual([
      first,
      second,
    ]);
    expect(ana.getSnapshot().sync.pending).toBe(0);
  });

  it('publishes a group made with no signal the first time it is online', async () => {
    const server = createMemoryServer();
    const group = newGroup();
    const anaPhone = phone(server, 'ana');
    anaPhone.signal.online = false;
    const ana = anaPhone.open(group, true);
    ana.submit({ kind: 'group.created', name: 'Japan 2026', currency: 'SGD' });
    await ana.syncNow();
    const offline = ana.getSnapshot().sync;

    anaPhone.signal.online = true;
    await ana.syncNow();

    expect(offline).toMatchObject({ state: 'offline', pending: 1, lastSyncedAt: null });
    expect(names(await serverLog(server, group))).toEqual(['group.created']);
  });

  it('puts group.created first in the log even when a friend writes the moment the group exists', async () => {
    const server = createMemoryServer();
    const group = newGroup();
    const benBackend = phone(server, 'ben').backend;
    const ana = phone(server, 'ana', (backend) => ({
      ...backend,
      // Ben opens the link and adds himself between Ana's publish and her first push.
      async publishGroup(...published) {
        const reply = await backend.publishGroup(...published);
        await benBackend.joinGroup(group.inviteCode);
        await benBackend.push(group.groupId, [pendingOp(addMember('Ben'))]);
        return reply;
      },
    })).open(group, true);

    ana.submit({ kind: 'group.created', name: 'Japan 2026', currency: 'SGD' });
    await ana.syncNow();

    expect(names(await serverLog(server, group))).toEqual(['group.created', 'member.put']);
  });

  it('retries after 2 seconds, then 4, and syncs once the signal is back', async () => {
    vi.useFakeTimers();
    const server = createMemoryServer();
    const anaPhone = phone(server, 'ana');
    anaPhone.signal.online = false;
    const ana = anaPhone.open(await foundedGroup(server), false);
    ana.submit(rename('Japan'));
    await vi.advanceTimersByTimeAsync(0);
    const sessions = vi.spyOn(anaPhone.backend, 'session');

    await vi.advanceTimersByTimeAsync(1_999);
    const beforeFirstRetry = sessions.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1);
    const afterFirstRetry = sessions.mock.calls.length;
    await vi.advanceTimersByTimeAsync(3_999);
    const beforeSecondRetry = sessions.mock.calls.length;
    anaPhone.signal.online = true;
    await vi.advanceTimersByTimeAsync(1);

    expect([beforeFirstRetry, afterFirstRetry, beforeSecondRetry]).toEqual([0, 1, 1]);
    expect(ana.getSnapshot().sync).toMatchObject({ state: 'idle', pending: 0 });
  });

  it('shows a server failure as an error and keeps the change for the retry', async () => {
    const server = createMemoryServer();
    let broken = true;
    const ana = phone(server, 'ana', (backend) => ({
      ...backend,
      pull: (groupId, afterSeq) =>
        broken
          ? Promise.resolve({ ok: false, failure: { kind: 'failed', message: 'boom' } })
          : backend.pull(groupId, afterSeq),
    })).open(await foundedGroup(server), false);

    ana.submit(rename('Japan'));
    await ana.syncNow();
    const whileBroken = ana.getSnapshot().sync;
    broken = false;
    await ana.syncNow();

    expect(whileBroken).toMatchObject({ state: 'error', pending: 1 });
    expect(ana.getSnapshot().sync).toMatchObject({ state: 'idle', pending: 0 });
  });

  it('still reads what others wrote while the server keeps failing its own changes, and says the outbox is stuck', async () => {
    const server = createMemoryServer();
    const group = await foundedGroup(server);
    const ben = phone(server, 'ben').open(group, false);
    await ben.syncNow();
    let pushFails = true;
    const ana = phone(server, 'ana', (backend) => ({
      ...backend,
      push: (groupId, ops) =>
        pushFails
          ? Promise.resolve({ ok: false, failure: { kind: 'failed', message: 'boom' } })
          : backend.push(groupId, ops),
    })).open(group, false);
    await ana.syncNow();

    ana.submit(addMember('Ana'));
    await ana.syncNow();
    ben.submit(rename('Japan, by Ben'));
    await ben.syncNow();
    await ana.syncNow();
    const whileFailing = ana.getSnapshot();
    pushFails = false;
    await ana.syncNow();

    expect(names(sinceFounded(whileFailing.log.confirmed))).toEqual(['Japan, by Ben']);
    expect(whileFailing.sync).toMatchObject({ state: 'error', pending: 1, outboxStuck: true });
    expect(whileFailing.sync.lastSyncedAt).not.toBeNull();
    expect(ana.getSnapshot().sync).toMatchObject({ state: 'idle', pending: 0, outboxStuck: false });
  });

  it('reports a backend that throws as an error instead of stopping for good', async () => {
    const server = createMemoryServer();
    let throwing = true;
    const ana = phone(server, 'ana', (backend) => ({
      ...backend,
      session: () => (throwing ? Promise.reject(new Error('bug')) : backend.session()),
    })).open(await foundedGroup(server), false);

    await ana.syncNow();
    const whileThrowing = ana.getSnapshot().sync.state;
    throwing = false;
    await ana.syncNow();

    expect(whileThrowing).toBe('error');
    expect(ana.getSnapshot().sync.state).toBe('idle');
  });

  it('says it is not a member when its invite code opens nothing, and keeps the change', async () => {
    const ben = phone(createMemoryServer(), 'ben').open(newGroup(), false);

    ben.submit(addMember('Ben'));
    await ben.syncNow();

    expect(ben.getSnapshot().sync).toMatchObject({ state: 'not-a-member', pending: 1 });
  });

  it('joins on its first sync, so it can read a group it has written nothing to', async () => {
    const server = createMemoryServer();
    const group = await foundedGroup(server);
    const ana = phone(server, 'ana').open(group, false);
    ana.submit(rename('Japan'));
    await ana.syncNow();

    const ben = phone(server, 'ben').open(group, false);
    await ben.syncNow();

    expect(names(sinceFounded(ben.getSnapshot().log.confirmed))).toEqual(['Japan']);
  });

  it('rejoins once with its invite code when the server says it is not a member', async () => {
    const server = createMemoryServer();
    const group = await foundedGroup(server);
    const ana = phone(server, 'ana').open(group, false);
    await ana.syncNow();
    const benPhone = phone(server, 'ben');
    // This phone believes it joined, as after a server reset or a restored backup.
    const session = await benPhone.backend.session();
    if (!session.ok) throw new Error('no session');
    openDeviceLog('ben', group.groupId).setMemberAs(session.value.userId);
    const ben = benPhone.open(group, false);

    const opId = ben.submit(addMember('Ben'));
    await ben.syncNow();

    expect(ben.getSnapshot().sync).toMatchObject({ state: 'idle', pending: 0 });
    expect(sinceFounded(await serverLog(server, group)).map((op) => op.id)).toEqual([opId]);
  });

  it('enters its groups again as the account it signed in to', async () => {
    const server = createMemoryServer();
    const group = await foundedGroup(server);
    const oldPhone = phone(server, 'old-phone');
    await oldPhone.backend.startEmailSignIn('ana@example.com');
    const account = await oldPhone.backend.verifyEmailCode('ana@example.com', FAKE_EMAIL_CODE);
    const benPhone = phone(server, 'ben');
    const owner = phone(server, 'owner').open(group, false);
    await owner.syncNow();
    const ben = benPhone.open(group, false);
    await ben.syncNow();

    await benPhone.backend.verifyEmailCode('ana@example.com', FAKE_EMAIL_CODE);
    const opId = ben.submit(addMember('Ben'));
    await ben.syncNow();

    const written = (await serverLog(server, group)).find((op) => op.id === opId);
    expect(account.ok && written?.userId === account.value.userId).toBe(true);
    expect(ben.getSnapshot().sync).toMatchObject({ state: 'idle', pending: 0 });
  });

  it('reads again an op it once could not read', async () => {
    const server = createMemoryServer();
    const group = await foundedGroup(server);
    const ana = phone(server, 'ana').open(group, false);
    ana.submit(rename('Japan'));
    ana.submit(rename('Japan 2026'));
    await ana.syncNow();
    const [founding, first, second] = ana.getSnapshot().log.confirmed;
    // An older Split on this phone stored the first rename as unreadable.
    openDeviceLog('ben', group.groupId).confirm([founding, { ...first, change: null }, second]);

    const ben = phone(server, 'ben').open(group, false);
    const stored = sinceFounded(ben.getSnapshot().log.confirmed).map((op) => op.change);
    await ben.syncNow();

    expect(stored).toEqual([null, rename('Japan 2026')]);
    expect(names(sinceFounded(ben.getSnapshot().log.confirmed))).toEqual(['Japan', 'Japan 2026']);
  });

  it('holds a change with a field a newer Split added as unreadable, rather than dropping the field', async () => {
    const server = createMemoryServer();
    const group = await foundedGroup(server);
    const newer = phone(server, 'newer');
    await newer.open(group, false).syncNow();
    const fromNewerSplit = {
      kind: 'member.put',
      member: { id: 'm-Ana', name: 'Ana', paynowMobile: null, archived: false, nickname: 'An' },
    } as unknown as Change;
    await newer.backend.push(group.groupId, [pendingOp(fromNewerSplit)]);

    const ben = phone(server, 'ben').open(group, false);
    await ben.syncNow();

    expect(sinceFounded(ben.getSnapshot().log.confirmed).map((op) => op.change)).toEqual([null]);
  });

  it('sends a queued change this version cannot read as it was stored, and counts it until then', async () => {
    const server = createMemoryServer();
    const group = await foundedGroup(server);
    const anaPhone = phone(server, 'ana');
    anaPhone.signal.online = false;
    // Queued by another version of Split on this phone, before the app was updated.
    const queued = {
      ...pendingOp({ kind: 'group.archived', reason: 'trip over' } as unknown as Change),
      order: 1,
    };
    window.localStorage.setItem(
      `split:g:ana:${group.groupId}:out:${queued.id}`,
      JSON.stringify(queued),
    );
    const ana = anaPhone.open(group, false);
    await ana.syncNow();
    const offline = ana.getSnapshot();

    anaPhone.signal.online = true;
    await ana.syncNow();
    const reader = createFakeBackend({ server, profile: 'reader', isOnline: () => true });
    const readerSession = await reader.session();
    await reader.joinGroup(group.inviteCode);
    const stored = await server.opsAfter(
      readerSession.ok ? readerSession.value.userId : '',
      group.groupId,
      0,
      10,
    );

    expect(offline.sync.pending).toBe(1);
    expect(offline.log.pending).toEqual([]);
    expect(offline.log.unreadablePending).toEqual([{ id: queued.id, order: 1, at: queued.at }]);
    expect(stored.ok && sinceFounded(stored.value).map((op) => [op.id, op.change])).toEqual([
      [queued.id, { kind: 'group.archived', reason: 'trip over' }],
    ]);
    expect(ana.getSnapshot().sync).toMatchObject({ state: 'idle', pending: 0, rejected: [] });
    expect(sinceFounded(ana.getSnapshot().log.confirmed).map((op) => [op.id, op.change])).toEqual([
      [queued.id, null],
    ]);
  });

  it('pulls when the server pokes, without being asked', async () => {
    const server = createMemoryServer();
    const group = await foundedGroup(server);
    const ana = phone(server, 'ana').open(group, false);
    await ana.syncNow();
    const ben = phone(server, 'ben').open(group, false);
    await ben.syncNow();

    ana.submit(rename('Japan'));
    await ana.syncNow();

    await vi.waitFor(() =>
      expect(names(sinceFounded(ben.getSnapshot().log.confirmed))).toEqual(['Japan']),
    );
  });

  it('syncs when the phone comes back online and when the tab is shown again', async () => {
    const server = createMemoryServer();
    const anaPhone = phone(server, 'ana');
    anaPhone.signal.online = false;
    const ana = anaPhone.open(await foundedGroup(server), false);
    ana.submit(rename('one'));
    await ana.syncNow();

    anaPhone.signal.online = true;
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(ana.getSnapshot().sync.pending).toBe(0));

    anaPhone.signal.online = false;
    ana.submit(rename('two'));
    await ana.syncNow();
    anaPhone.signal.online = true;
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(ana.getSnapshot().sync.pending).toBe(0));
  });

  it('shows a change made in another tab of the same phone', async () => {
    const server = createMemoryServer();
    const group = newGroup();
    const anaPhone = phone(server, 'ana');
    anaPhone.signal.online = false;
    const tabOne = anaPhone.open(group, true);
    const tabTwo = anaPhone.open(group, true);

    const opId = tabOne.submit(rename('Japan'));
    window.dispatchEvent(
      new StorageEvent('storage', { key: `split:g:ana:${group.groupId}:out:${opId}` }),
    );
    window.dispatchEvent(new StorageEvent('storage', { key: 'split:something-else' }));

    expect(tabTwo.getSnapshot().log.pending.map((op) => op.id)).toEqual([opId]);
  });

  it('pulls again when another tab, confirming at the same moment, wrote back a shorter log', async () => {
    const server = createMemoryServer();
    const group = await foundedGroup(server);
    const tab = phone(server, 'ana').open(group, false);
    tab.submit(rename('one'));
    tab.submit(rename('two'));
    await tab.syncNow();
    const key = `split:g:ana:${group.groupId}:confirmed`;
    // The other tab read the log before this tab's last page and wrote it back after.
    const stale = JSON.stringify(tab.getSnapshot().log.confirmed.slice(0, 2));

    window.localStorage.setItem(key, stale);
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: stale }));
    const shrunk = tab.getSnapshot().log.confirmed.length;

    await vi.waitFor(() => expect(tab.getSnapshot().log.confirmed).toHaveLength(3));
    expect(shrunk).toBe(2);
    expect(openDeviceLog('ana', group.groupId).confirmed()).toHaveLength(3);
  });

  it('leaves a group forgotten in another tab forgotten', async () => {
    const server = createMemoryServer();
    const group = await foundedGroup(server);
    const tab = phone(server, 'ana').open(group, false);
    await tab.syncNow();
    const pulls = vi.spyOn(server, 'opsAfter');

    openDeviceLog('ana', group.groupId).clear();
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: `split:g:ana:${group.groupId}:confirmed`,
        newValue: null,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(tab.getSnapshot().log.confirmed).toEqual([]);
    expect(pulls).not.toHaveBeenCalled();
    expect(openDeviceLog('ana', group.groupId).confirmed()).toEqual([]);
  });

  it('writes nothing back to a phone that forgot the group while a pull was on its way', async () => {
    const server = createMemoryServer();
    const group = await foundedGroup(server);
    let answer = () => {};
    const held = new Promise<void>((resolve) => {
      answer = resolve;
    });
    const pull = vi.fn();
    const ana = phone(server, 'ana', (backend) => ({
      ...backend,
      async pull(groupId, afterSeq) {
        const reply = await backend.pull(groupId, afterSeq);
        pull();
        await held;
        return reply;
      },
    })).open(group, false);
    await vi.waitFor(() => expect(pull).toHaveBeenCalled());

    // What `forgetGroup` does.
    ana.dispose();
    openDeviceLog('ana', group.groupId).clear();
    answer();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(Object.keys(window.localStorage).filter((key) => key.includes(group.groupId))).toEqual(
      [],
    );
  });

  it('does nothing more once disposed', async () => {
    const server = createMemoryServer();
    const group = await foundedGroup(server);
    const ana = phone(server, 'ana').open(group, false);
    await ana.syncNow();

    ana.dispose();
    ana.submit(rename('after dispose'));
    await ana.syncNow();

    expect(names(await serverLog(server, group))).toEqual(['group.created']);
  });
});
