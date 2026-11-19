import type {
  Change,
  GroupId,
  GroupLog,
  InviteCode,
  OpId,
  PendingOp,
  UnreadablePendingOp,
} from '@features/group-ledger/domain/types';
import { createBackend, deviceProfile } from '@features/group-ledger/backend/createBackend';
import { PUSH_BATCH_SIZE } from '@features/group-ledger/backend/limits';
import type { BackendFailure, LedgerBackend, Session } from '@features/group-ledger/backend/port';
import { parseChange } from '@features/group-ledger/logic/codec';
import { foldLedger } from '@features/group-ledger/logic/fold';
import { openDeviceLog, type DeviceLog } from '@features/group-ledger/sync/deviceLog';
import { useJoinedGroupsStore } from '@features/group-ledger/sync/joinedGroupsStore';

export type SyncState =
  | 'idle'
  | 'syncing'
  /** No connection. Retries on a timer and when the phone comes back online. */
  | 'offline'
  /** The server failed. Retries on a timer. */
  | 'error'
  /** The invite code no longer opens the group. Nothing retries until `syncNow` is called. */
  | 'not-a-member';

export interface SyncStatus {
  state: SyncState;
  /** Changes still only on this phone, counting any this version of Split cannot read. */
  pending: number;
  /** When this tab last reached the head of the log. Null until it has. */
  lastSyncedAt: string | null;
  /** Changes the server refused for good and this phone dropped, oldest first. */
  rejected: OpId[];
  /**
   * The server failed when it was sent this phone's changes, on the last run. The changes are
   * kept and sent again on the retry timer, and what others wrote is still read meanwhile.
   */
  outboxStuck: boolean;
  /** Changes this phone had no room to store, held in memory until the server takes them. */
  unstored: number;
}

interface RunOutcome {
  failure: BackendFailure | null;
  /** The pull reached the head of the log, whatever became of the push. */
  reachedHead: boolean;
  outboxStuck: boolean;
}

function stopped(failure: BackendFailure): RunOutcome {
  return { failure, reachedHead: false, outboxStuck: false };
}

export interface GroupSnapshot {
  log: GroupLog;
  sync: SyncStatus;
}

export interface GroupSync {
  /** The same object until something changes, so it works with `useSyncExternalStore`. */
  getSnapshot(): GroupSnapshot;
  subscribe(listener: () => void): () => void;
  /** Stores the change on this phone before it returns, then syncs. */
  submit(change: Change): OpId;
  /** Resolves when the run it started, or joined, has ended, whether or not it worked. */
  syncNow(): Promise<void>;
  dispose(): void;
}

export interface GroupSyncOptions {
  group: { groupId: GroupId; inviteCode: InviteCode; createdHere: boolean };
  backend: LedgerBackend;
  log: DeviceLog;
  now?: () => string;
  /** Told the session each run starts from. */
  onSession?: (session: Session) => void;
}

const FIRST_RETRY_MS = 2_000;
const LAST_RETRY_MS = 60_000;

export function createGroupSync({
  group,
  backend,
  log,
  now = () => new Date().toISOString(),
  onSession,
}: GroupSyncOptions): GroupSync {
  const { groupId, inviteCode } = group;
  const listeners = new Set<() => void>();

  let status: SyncStatus = {
    state: 'idle',
    pending: 0,
    lastSyncedAt: null,
    rejected: [],
    outboxStuck: false,
    unstored: 0,
  };
  let snapshot = snapshotOf(readLog());
  let running: Promise<void> | null = null;
  let requested = false;
  let disposed = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryMs = FIRST_RETRY_MS;
  let rereadUnreadable = true;

  function unlessDisposed<Args extends unknown[]>(write: (...args: Args) => void) {
    return (...args: Args) => {
      if (!disposed) write(...args);
    };
  }
  const confirm = unlessDisposed(log.confirm);
  const drop = unlessDisposed(log.drop);
  const setMemberAs = unlessDisposed(log.setMemberAs);

  function readLog(): GroupLog {
    const pending: PendingOp[] = [];
    const unreadablePending: UnreadablePendingOp[] = [];
    for (const { id, order, at, change: stored } of log.outbox()) {
      const change = parseChange(stored);
      if (change === null) unreadablePending.push({ id, order, at });
      else pending.push({ id, order, at, change });
    }
    return { groupId, inviteCode, confirmed: log.confirmed(), pending, unreadablePending };
  }

  function snapshotOf(held: GroupLog): GroupSnapshot {
    const queued = held.pending.length + (held.unreadablePending?.length ?? 0);
    return { log: held, sync: { ...status, pending: queued, unstored: log.unstored() } };
  }

  function publish(next: Partial<SyncStatus>, held: GroupLog = snapshot.log) {
    status = { ...status, ...next };
    snapshot = snapshotOf(held);
    for (const listener of listeners) listener();
  }

  function reload(next: Partial<SyncStatus> = {}) {
    publish(next, readLog());
  }

  async function enter(): Promise<BackendFailure | null> {
    const firstOp = group.createdHere
      ? log.outbox().find((op) => parseChange(op.change)?.kind === 'group.created')
      : undefined;
    const entered = firstOp
      ? await backend.publishGroup({ groupId, inviteCode }, firstOp)
      : await backend.joinGroup(inviteCode);
    return entered.ok ? null : entered.failure;
  }

  async function pushPending(reenter: () => Promise<BackendFailure | null>) {
    const pending = log.outbox();
    let reentered = false;
    for (let start = 0; start < pending.length; start += PUSH_BATCH_SIZE) {
      const batch = pending.slice(start, start + PUSH_BATCH_SIZE);
      let pushed = await backend.push(groupId, batch);
      if (!pushed.ok && pushed.failure.kind === 'not-a-member' && !reentered) {
        reentered = true;
        const failure = await reenter();
        if (failure !== null) return failure;
        pushed = await backend.push(groupId, batch);
      }
      if (!pushed.ok) return pushed.failure;
      if (pushed.value.rejected.length > 0) {
        drop(pushed.value.rejected);
        reload({ rejected: [...status.rejected, ...pushed.value.rejected] });
      }
    }
    return null;
  }

  async function pullToHead() {
    const confirmed = log.confirmed();
    const firstUnreadable = rereadUnreadable ? confirmed.find((op) => op.change === null) : null;
    let afterSeq = firstUnreadable ? firstUnreadable.seq - 1 : confirmed.length;
    for (;;) {
      const pulled = await backend.pull(groupId, afterSeq);
      if (!pulled.ok) return pulled.failure;
      const last = pulled.value.ops.at(-1);
      if (last) {
        confirm(pulled.value.ops);
        reload();
        afterSeq = last.seq;
      }
      if (!pulled.value.more || !last || disposed) break;
    }
    rereadUnreadable = false;
    return null;
  }

  async function runOnce(): Promise<RunOutcome> {
    try {
      const session = await backend.session();
      if (!session.ok) return stopped(session.failure);
      onSession?.(session.value);
      const { userId } = session.value;

      async function enterAsUser() {
        const failure = await enter();
        if (failure === null) setMemberAs(userId);
        return failure;
      }
      if (log.memberAs() !== userId) {
        const failure = await enterAsUser();
        if (failure !== null) return stopped(failure);
      }

      const pushFailure = await pushPending(enterAsUser);
      if (pushFailure !== null && pushFailure.kind !== 'failed') return stopped(pushFailure);
      const pullFailure = await pullToHead();
      return {
        failure: pushFailure ?? pullFailure,
        reachedHead: pullFailure === null,
        outboxStuck: pushFailure !== null,
      };
    } catch (error) {
      return stopped({
        kind: 'failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  function settle({ failure, reachedHead, outboxStuck }: RunOutcome) {
    const lastSyncedAt = reachedHead ? now() : status.lastSyncedAt;
    if (failure === null) {
      retryMs = FIRST_RETRY_MS;
      publish({ state: 'idle', lastSyncedAt, outboxStuck });
      return;
    }
    if (failure.kind === 'not-a-member' || failure.kind === 'invite-not-found') {
      publish({ state: 'not-a-member', outboxStuck });
      return;
    }
    publish({ state: failure.kind === 'offline' ? 'offline' : 'error', lastSyncedAt, outboxStuck });
    retryTimer = setTimeout(() => void syncNow(), retryMs);
    retryMs = Math.min(retryMs * 2, LAST_RETRY_MS);
  }

  async function drain() {
    while (requested && !disposed) {
      requested = false;
      if (retryTimer !== null) clearTimeout(retryTimer);
      retryTimer = null;
      publish({ state: 'syncing' });
      const outcome = await runOnce();
      if (disposed) return;
      settle(outcome);
      if (outcome.failure !== null) requested = false;
    }
  }

  function syncNow(): Promise<void> {
    if (disposed) return Promise.resolve();
    requested = true;
    running ??= drain().finally(() => {
      running = null;
    });
    return running;
  }

  const sync = () => void syncNow();
  const syncWhenVisible = () => {
    if (document.visibilityState === 'visible') sync();
  };
  /**
   * Another tab wrote this group's log. Sync when it wrote back a shorter log, to pull what it
   * missed, or queued a change, which this tab sends too in case that tab closes first. Pushing
   * twice is safe: the server keeps one copy of each op.
   */
  const onStorage = (event: StorageEvent) => {
    if (!log.owns(event.key)) return;
    const held = snapshot.log.confirmed.length;
    const queued = snapshot.sync.pending;
    reload();
    const shrank = snapshot.log.confirmed.length < held;
    const grew = snapshot.sync.pending > queued;
    if (event.newValue !== null && (shrank || grew)) sync();
  };

  const unsubscribe = backend.subscribe(groupId, sync);
  window.addEventListener('online', sync);
  window.addEventListener('storage', onStorage);
  document.addEventListener('visibilitychange', syncWhenVisible);
  sync();

  return {
    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    submit(change) {
      const op = log.appendPending(change);
      reload();
      sync();
      return op.id;
    },

    syncNow,

    dispose() {
      disposed = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
      unsubscribe();
      window.removeEventListener('online', sync);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', syncWhenVisible);
      listeners.clear();
    },
  };
}

let backend: LedgerBackend | null = null;

export function ledgerBackend(): LedgerBackend {
  backend ??= createBackend();
  return backend;
}

const engines = new Map<GroupId, GroupSync>();
const sessionListeners = new Set<(session: Session) => void>();

/** Tells `listener` the session every group's sync runs as, so the account learns who this phone is. */
export function onSessionSeen(listener: (session: Session) => void): () => void {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

/**
 * The engine for a group this phone holds, started on first use. Null for any other group.
 * It keeps the home list's copy of the group's name in step with the log.
 */
export function groupSyncFor(groupId: GroupId): GroupSync | null {
  const running = engines.get(groupId);
  if (running) return running;

  const group = useJoinedGroupsStore.getState().groups.find((held) => held.groupId === groupId);
  if (!group) return null;

  const engine = createGroupSync({
    group,
    backend: ledgerBackend(),
    log: openDeviceLog(deviceProfile(), groupId),
    onSession: (session) => {
      for (const listener of sessionListeners) listener(session);
    },
  });
  let named: GroupLog | null = null;
  engine.subscribe(() => {
    const { log } = engine.getSnapshot();
    if (log === named) return;
    named = log;
    rememberName(groupId, log);
  });
  engines.set(groupId, engine);
  return engine;
}

function rememberName(groupId: GroupId, log: GroupLog) {
  const name = foldLedger(log, null)?.name;
  const joined = useJoinedGroupsStore.getState();
  const held = joined.groups.find((group) => group.groupId === groupId);
  if (name !== undefined && held !== undefined && held.name !== name) joined.setName(groupId, name);
}

/** Syncs every group this phone holds, entering each as the current user where it has not. */
export async function syncAllGroups(): Promise<void> {
  const groups = useJoinedGroupsStore.getState().groups;
  await Promise.all(groups.map((group) => groupSyncFor(group.groupId)?.syncNow()));
}

/**
 * Takes a group off this phone: its engine, its log and any change not yet synced. A sync still
 * on its way writes nothing afterwards. The server keeps this user as a member, so the invite
 * link brings the group back.
 */
export function forgetGroup(groupId: GroupId): void {
  engines.get(groupId)?.dispose();
  engines.delete(groupId);
  openDeviceLog(deviceProfile(), groupId).clear();
  useJoinedGroupsStore.getState().remove(groupId);
}
