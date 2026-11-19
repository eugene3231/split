import { z } from 'zod';
import type {
  ConfirmedOp,
  GroupId,
  InviteCode,
  OpId,
  UserId,
} from '@features/group-ledger/domain/types';
import type { FakeServer } from '@features/group-ledger/backend/fakeServer';
import { PULL_PAGE_SIZE } from '@features/group-ledger/backend/limits';
import type {
  BackendFailure,
  LedgerBackend,
  Result,
  Session,
} from '@features/group-ledger/backend/port';
import { confirmedOpSchema } from '@features/group-ledger/logic/codec';
import { newUuid } from '@features/group-ledger/logic/ids';
import { jsonStorage } from '@features/split-workspace/logic/jsonStorage';

export interface FakeBackendOptions {
  server: FakeServer;
  profile: string;
  /** False makes every call that needs the server fail with `offline`. */
  isOnline: () => boolean;
}

export const FAKE_EMAIL_CODE = '000000';

const OFFLINE: { ok: false; failure: BackendFailure } = { ok: false, failure: { kind: 'offline' } };

function failed(message: string): { ok: false; failure: BackendFailure } {
  return { ok: false, failure: { kind: 'failed', message } };
}

const storedSessionSchema = z.object({ userId: z.string().min(1), email: z.string().nullable() });
type StoredSession = z.infer<typeof storedSessionSchema>;

function toSession(stored: StoredSession): Session {
  return {
    userId: stored.userId as UserId,
    account:
      stored.email === null ? { kind: 'anonymous' } : { kind: 'linked', email: stored.email },
  };
}

export function createFakeBackend({
  server,
  profile,
  isOnline,
}: FakeBackendOptions): LedgerBackend {
  const sessionKey = `split.fakeBackend.${profile}.session`;
  const sessionStore = jsonStorage('localStorage', sessionKey, storedSessionSchema);

  function currentSession(): StoredSession | null {
    const stored = sessionStore.load();
    if (stored !== null) return stored;
    if (!isOnline()) return null;
    const fresh = { userId: newUuid(), email: null };
    sessionStore.save(fresh);
    return fresh;
  }

  async function online<T>(
    call: (session: StoredSession) => Promise<Result<T>>,
  ): Promise<Result<T>> {
    const session = isOnline() ? currentSession() : null;
    return session === null ? OFFLINE : call(session);
  }

  return {
    async session() {
      const session = currentSession();
      return session === null ? OFFLINE : { ok: true, value: toSession(session) };
    },

    startEmailSignIn: (email) =>
      online<{ mode: 'link' | 'sign-in' }>(async (session) => {
        const owner = await server.emailOwner(email);
        if (!owner.ok) return owner;
        if (owner.value !== null) return { ok: true, value: { mode: 'sign-in' } };
        return session.email === null
          ? { ok: true, value: { mode: 'link' } }
          : failed('No account uses that email.');
      }),

    verifyEmailCode: (email, code) =>
      online(async (session) => {
        if (code !== FAKE_EMAIL_CODE) return failed('That code is not right.');
        const owner = await server.claimEmail(email, session.userId);
        if (!owner.ok) return owner;
        const next = { userId: owner.value, email: email.trim() };
        sessionStore.save(next);
        return { ok: true, value: toSession(next) };
      }),

    signOut: () =>
      online(async () => {
        try {
          window.localStorage.removeItem(sessionKey);
        } catch {
          // Storage is blocked; there was no stored session to remove.
        }
        return { ok: true, value: undefined };
      }),

    myGroups: () =>
      online(async (session) => {
        const groups = await server.myGroups(session.userId);
        if (!groups.ok) return groups;
        return {
          ok: true,
          value: groups.value.map((group) => ({
            groupId: group.groupId as GroupId,
            inviteCode: group.inviteCode as InviteCode,
          })),
        };
      }),

    publishGroup: (group, { id, at, change }) =>
      online((session) =>
        server.createGroup(session.userId, group.groupId, group.inviteCode, { id, at, change }),
      ),

    joinGroup: (inviteCode) =>
      online(async (session) => {
        const groupId = await server.joinGroup(session.userId, inviteCode);
        if (!groupId.ok) return groupId;
        return { ok: true, value: { groupId: groupId.value as GroupId, inviteCode } };
      }),

    push: (groupId, ops) =>
      online(async (session) => {
        const outcome = await server.appendOps(
          session.userId,
          groupId,
          ops.map(({ id, at, change }) => ({ id, at, change })),
        );
        if (!outcome.ok) return outcome;
        return {
          ok: true,
          value: {
            accepted: outcome.value.accepted as OpId[],
            rejected: outcome.value.rejected as OpId[],
          },
        };
      }),

    pull: (groupId, afterSeq) =>
      online(async (session) => {
        const rows = await server.opsAfter(session.userId, groupId, afterSeq, PULL_PAGE_SIZE + 1);
        if (!rows.ok) return rows;
        const ops: ConfirmedOp[] = [];
        for (const row of rows.value.slice(0, PULL_PAGE_SIZE)) {
          const op = confirmedOpSchema.safeParse(row);
          if (!op.success) return failed('The server sent an op that could not be read.');
          ops.push(op.data);
        }
        return { ok: true, value: { ops, more: rows.value.length > PULL_PAGE_SIZE } };
      }),

    subscribe: (groupId, onPoke) =>
      server.subscribe(groupId, () => {
        if (isOnline()) onPoke();
      }),
  };
}

const PROFILE_KEY = 'split.fakeBackend.profile';

export function tabProfile(): string {
  const storage = jsonStorage('sessionStorage', PROFILE_KEY, z.string().min(1));
  const named = new URLSearchParams(window.location.search).get('phone');
  const profile = named || storage.load() || newUuid();
  storage.save(profile);
  return profile;
}

let switchedOffline = false;

export function setFakeOffline(offline: boolean): void {
  switchedOffline = offline;
  if (!offline) window.dispatchEvent(new Event('online'));
}

export function isFakeOnline(): boolean {
  return !switchedOffline && !new URLSearchParams(window.location.search).has('offline');
}
