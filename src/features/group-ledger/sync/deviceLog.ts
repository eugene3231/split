import { z } from 'zod';
import type {
  Change,
  ConfirmedOp,
  GroupId,
  OpId,
  PendingOp,
  UserId,
} from '@features/group-ledger/domain/types';
import { confirmedOpSchema, idSchemas, parseChange } from '@features/group-ledger/logic/codec';
import { newOpId } from '@features/group-ledger/logic/ids';
import { jsonStorage, lenientArray, parseJson } from '@shared/logic/jsonStorage';

export interface OutboxOp {
  id: OpId;
  order: number;
  at: string;
  change: unknown;
}

const outboxOpSchema: z.ZodType<OutboxOp> = z.object({
  id: idSchemas.opId,
  order: z.number().int().nonnegative(),
  at: z.string(),
  change: z.unknown(),
});

export interface DeviceLog {
  /** In `seq` order from 1 with no gaps. */
  confirmed(): ConfirmedOp[];
  /** Every op the server has not confirmed, in the order this phone made them. */
  outbox(): OutboxOp[];
  pending(): PendingOp[];
  /**
   * Stored before it returns, so the op survives a reload that comes before any network call.
   * When storage is full it is kept in memory instead, and counted by `unstored` until confirmed.
   */
  appendPending(change: Change): PendingOp;
  /** Pending ops held only in memory because storage was full. A reload would lose them. */
  unstored(): number;
  /**
   * Takes ops the server confirmed and retires the pending ops among them. Safe to repeat.
   * It reads the stored log and writes it back in one synchronous step, but two tabs are two
   * processes, so one tab's write can still leave out a page the other just wrote. The engine
   * hears that as a `storage` event with a shorter log and pulls again.
   */
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
  const unsaved = new Map<OpId, PendingOp>();

  function confirmed(): ConfirmedOp[] {
    return withoutGaps(confirmedStore.load() ?? []);
  }

  function outbox(): OutboxOp[] {
    const stored = storageKeys(outPrefix).flatMap((key) => {
      const raw = window.localStorage.getItem(key);
      const op = raw === null ? null : parseJson(raw, outboxOpSchema);
      return op === null ? [] : [op];
    });
    const storedIds = new Set(stored.map((op) => op.id));
    return [...stored, ...[...unsaved.values()].filter((op) => !storedIds.has(op.id))].sort(
      (a, b) => a.order - b.order || a.id.localeCompare(b.id),
    );
  }

  function pending(): PendingOp[] {
    return outbox().flatMap((op) => {
      const change = parseChange(op.change);
      return change === null ? [] : [{ ...op, change }];
    });
  }

  return {
    confirmed,
    outbox,
    pending,
    unstored: () => unsaved.size,

    appendPending(change) {
      const lastOrder = Math.max(orderStore.load() ?? 0, ...outbox().map((op) => op.order));
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
