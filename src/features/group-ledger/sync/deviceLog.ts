import { z } from 'zod';
import type {
  Change,
  ConfirmedOp,
  GroupId,
  OpId,
  PendingOp,
  UserId,
} from '@features/group-ledger/domain/types';
import { confirmedOpSchema, idSchemas, pendingOpSchema } from '@features/group-ledger/logic/codec';
import { newOpId } from '@features/group-ledger/logic/ids';
import { jsonStorage, lenientArray, parseJson } from '@features/split-workspace/logic/jsonStorage';

// This phone's copy of one group, in localStorage:
//   split:g:<profile>:<groupId>:confirmed    every op the server has confirmed, rewritten whole
//   split:g:<profile>:<groupId>:out:<opId>   one key per op the server has not confirmed yet
//   split:g:<profile>:<groupId>:member       the user this phone last entered the group as
//   split:g:<profile>:order                  the counter that orders this phone's own ops
// A pending op has its own key so two tabs can each add one without overwriting the other.
// Moving to IndexedDB changes this file only.

export interface DeviceLog {
  /** In `seq` order from 1 with no gaps. */
  confirmed(): ConfirmedOp[];
  /** In the order this phone made them. */
  pending(): PendingOp[];
  /** Stored before it returns, so the op survives a reload that comes before any network call. */
  appendPending(change: Change): PendingOp;
  /** Takes ops the server confirmed and retires the pending ops among them. Safe to repeat. */
  confirm(ops: readonly ConfirmedOp[]): void;
  /** Forgets pending ops the server will never take. */
  drop(opIds: readonly OpId[]): void;
  /** The user this phone last entered the group as: created it or joined it on the server. */
  memberAs(): UserId | null;
  setMemberAs(userId: UserId): void;
  /** Whether a storage key belongs to this log, for hearing another tab's writes. */
  owns(key: string | null): boolean;
  /** Removes the group from this phone, pending ops included. */
  clear(): void;
}

/** The ops from `seq` 1 up to the first gap. What follows a gap is pulled again. */
function withoutGaps(ops: readonly ConfirmedOp[]): ConfirmedOp[] {
  const sorted = [...ops].sort((a, b) => a.seq - b.seq);
  const firstGap = sorted.findIndex((op, index) => op.seq !== index + 1);
  return firstGap === -1 ? sorted : sorted.slice(0, firstGap);
}

function storageKeys(prefix: string): string[] {
  try {
    return Object.keys(window.localStorage).filter((key) => key.startsWith(prefix));
  } catch {
    return [];
  }
}

function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage is blocked, so nothing was stored under the key.
  }
}

export function openDeviceLog(
  profile: string,
  groupId: GroupId,
  now: () => string = () => new Date().toISOString(),
): DeviceLog {
  const prefix = `split:g:${profile}:${groupId}:`;
  const outPrefix = `${prefix}out:`;
  const confirmedStore = jsonStorage(
    'localStorage',
    `${prefix}confirmed`,
    lenientArray(confirmedOpSchema),
  );
  const memberStore = jsonStorage('localStorage', `${prefix}member`, idSchemas.userId);
  const orderStore = jsonStorage(
    'localStorage',
    `split:g:${profile}:order`,
    z.number().int().nonnegative(),
  );
  // Ops that could not be written because storage is full or blocked. They last as long as the
  // tab does, which is long enough to push them when the phone is online.
  const unsaved = new Map<OpId, PendingOp>();

  function confirmed(): ConfirmedOp[] {
    return withoutGaps(confirmedStore.load() ?? []);
  }

  function pending(): PendingOp[] {
    const stored = storageKeys(outPrefix).flatMap((key) => {
      const raw = window.localStorage.getItem(key);
      const op = raw === null ? null : parseJson(raw, pendingOpSchema);
      return op === null ? [] : [op];
    });
    const storedIds = new Set(stored.map((op) => op.id));
    return [...stored, ...[...unsaved.values()].filter((op) => !storedIds.has(op.id))].sort(
      (a, b) => a.order - b.order || a.id.localeCompare(b.id),
    );
  }

  return {
    confirmed,
    pending,

    appendPending(change) {
      // The counter alone would restart at 1 if only its key were lost.
      const lastOrder = Math.max(orderStore.load() ?? 0, ...pending().map((op) => op.order));
      const op: PendingOp = {
        id: newOpId(),
        order: lastOrder + 1,
        at: now(),
        change,
      };
      orderStore.save(op.order);
      try {
        window.localStorage.setItem(`${outPrefix}${op.id}`, JSON.stringify(op));
      } catch {
        unsaved.set(op.id, op);
      }
      return op;
    },

    confirm(ops) {
      if (ops.length === 0) return;
      const bySeq = new Map(confirmed().map((op) => [op.seq, op]));
      for (const op of ops) bySeq.set(op.seq, op);
      confirmedStore.save(withoutGaps([...bySeq.values()]));

      // Retire only what the stored log now holds. If the write failed, the op stays pending
      // and on screen, and is pushed again, which the server answers with "accepted".
      const held = new Set(confirmed().map((op) => op.id));
      for (const op of ops) {
        if (!held.has(op.id)) continue;
        removeKey(`${outPrefix}${op.id}`);
        unsaved.delete(op.id);
      }
    },

    drop(opIds) {
      for (const id of opIds) {
        removeKey(`${outPrefix}${id}`);
        unsaved.delete(id);
      }
    },

    memberAs: () => memberStore.load(),
    setMemberAs: (userId) => memberStore.save(userId),

    owns: (key) => key !== null && key.startsWith(prefix),

    clear() {
      for (const key of storageKeys(prefix)) removeKey(key);
      unsaved.clear();
    },
  };
}
