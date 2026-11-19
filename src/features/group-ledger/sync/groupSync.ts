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
import type { BackendFailure, LedgerBackend, Session } from '@features/group-ledger/backend/port';
import { parseChange } from '@features/group-ledger/logic/codec';
import { foldLedger } from '@features/group-ledger/logic/fold';
import { openDeviceLog, type DeviceLog } from '@features/group-ledger/sync/deviceLog';
import { useJoinedGroupsStore } from '@features/group-ledger/sync/joinedGroupsStore';
import {
  initialSyncMachine,
  stepSync,
  syncStateOf,
  type SyncEffect,
  type SyncEvent,
  type SyncReads,
  type SyncState,
} from '@features/group-ledger/sync/syncMachine';

export type { SyncState } from '@features/group-ledger/sync/syncMachine';

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

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The shell around `stepSync`: it turns browser and backend happenings into events and carries
 * out the effects. Every decision about when to run, retry or stop is in `syncMachine.ts`.
 */
export function createGroupSync({
  group,
  backend,
  log,
  now = () => new Date().toISOString(),
  onSession,
}: GroupSyncOptions): GroupSync {
  const { groupId, inviteCode } = group;
  const listeners = new Set<() => void>();
  const reads: SyncReads = {
    memberAs: () => log.memberAs(),
    outbox: () => log.outbox(),
    confirmed: () => log.confirmed(),
    now,
  };

  let machine = initialSyncMachine;
  let snapshot = snapshotOf(readLog());
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  /** Settles when the machine next leaves `running`. What `syncNow` hands back. */
  let drained: { promise: Promise<void>; resolve: () => void } | null = null;

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
    const { lastSyncedAt, rejected, outboxStuck } = machine;
    return {
      log: held,
      sync: {
        state: syncStateOf(machine.phase),
        pending: queued,
        lastSyncedAt,
        rejected,
        outboxStuck,
        unstored: log.unstored(),
      },
    };
  }

  function publish(held: GroupLog) {
    snapshot = snapshotOf(held);
    for (const listener of listeners) listener();
  }

  function reload() {
    publish(readLog());
  }

  function publishIfShownChanged() {
    const shown = snapshot.sync;
    const unchanged =
      shown.state === syncStateOf(machine.phase) &&
      shown.lastSyncedAt === machine.lastSyncedAt &&
      shown.rejected === machine.rejected &&
      shown.outboxStuck === machine.outboxStuck;
    if (!unchanged) publish(snapshot.log);
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

  /** Feeds the machine the call's reply once it settles, or `threw` if it rejects. */
  function reply<T>(call: () => Promise<T>, toEvent: (value: T) => SyncEvent) {
    call().then(
      (value) => deliver(toEvent(value)),
      (error: unknown) => deliver({ type: 'threw', message: messageOf(error) }),
    );
  }

  function run(effect: SyncEffect) {
    switch (effect.type) {
      case 'clear-retry':
        if (retryTimer !== null) clearTimeout(retryTimer);
        retryTimer = null;
        return;
      case 'arm-retry':
        retryTimer = setTimeout(() => deliver({ type: 'retry-due' }), effect.ms);
        return;
      case 'ask-session':
        return reply(
          () => backend.session(),
          (result) => ({ type: 'session-replied', result }),
        );
      case 'tell-session':
        onSession?.(effect.session);
        return;
      case 'enter':
        return reply(enter, (failure) => ({ type: 'entered', failure }));
      case 'remember-member':
        log.setMemberAs(effect.userId);
        return;
      case 'push':
        return reply(
          () => backend.push(groupId, effect.batch),
          (result) => ({ type: 'pushed', result }),
        );
      case 'drop':
        log.drop(effect.opIds);
        reload();
        return;
      case 'pull':
        return reply(
          () => backend.pull(groupId, effect.afterSeq),
          (result) => ({ type: 'pulled', result }),
        );
      case 'confirm':
        log.confirm(effect.ops);
        reload();
        return;
    }
  }

  function dispatch(event: SyncEvent) {
    const wasRunning = machine.phase.kind === 'running';
    const next = stepSync(machine, event, reads);
    machine = next.machine;
    const isRunning = machine.phase.kind === 'running';
    if (!wasRunning && isRunning) {
      let resolve = () => {};
      const promise = new Promise<void>((settle) => {
        resolve = settle;
      });
      drained = { promise, resolve };
    }
    if (wasRunning && !isRunning) {
      drained?.resolve();
      drained = null;
    }
    for (const effect of next.effects) run(effect);
    publishIfShownChanged();
  }

  /** A step that throws, reading or writing storage, ends the run as a failure. */
  function deliver(event: SyncEvent) {
    try {
      dispatch(event);
    } catch (error) {
      dispatch({ type: 'threw', message: messageOf(error) });
    }
  }

  function syncNow(): Promise<void> {
    deliver({ type: 'sync-asked' });
    return drained?.promise ?? Promise.resolve();
  }

  const onPoke = () => deliver({ type: 'poked' });
  const onOnline = () => deliver({ type: 'online' });
  const onVisibility = () =>
    deliver({ type: 'visibility', visible: document.visibilityState === 'visible' });
  /**
   * Another tab wrote this group's log. The machine syncs when it wrote back a shorter log, to
   * pull what it missed, or queued a change, which this tab sends too in case that tab closes
   * first. Pushing twice is safe: the server keeps one copy of each op.
   */
  const onStorage = (event: StorageEvent) => {
    if (!log.owns(event.key)) return;
    const held = snapshot.log.confirmed.length;
    const queued = snapshot.sync.pending;
    reload();
    deliver({
      type: 'other-tab-wrote',
      removed: event.newValue === null,
      confirmedShrank: snapshot.log.confirmed.length < held,
      outboxGrew: snapshot.sync.pending > queued,
    });
  };

  const unsubscribe = backend.subscribe(groupId, onPoke);
  window.addEventListener('online', onOnline);
  window.addEventListener('storage', onStorage);
  document.addEventListener('visibilitychange', onVisibility);
  deliver({ type: 'sync-asked' });

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
      deliver({ type: 'sync-asked' });
      return op.id;
    },

    syncNow,

    dispose() {
      deliver({ type: 'disposed' });
      unsubscribe();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
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
