import { z } from 'zod';
import type { Result } from '@features/group-ledger/backend/port';
import { changeBytes, MAX_CHANGE_BYTES } from '@features/group-ledger/backend/limits';
import { parseJson } from '@features/split-workspace/logic/jsonStorage';

// The server's rules, stated once in TypeScript: the same rules as the SQL functions in
// supabase/migrations/*_group_ledger.sql, and `sqlContract.test.ts` holds the two together.
// A rule is a pure function from a state to the next state and a reply. A store runs one rule
// at a time, in memory for tests or in localStorage for `pnpm dev`.
//
// Ids are plain strings here. Like the real server, this one knows nothing about the domain
// types, and the backend parses what it sends back.

const storedOpSchema = z.object({
  id: z.string(),
  seq: z.number(),
  at: z.string(),
  change: z.unknown(),
  userId: z.string(),
});

const serverStateSchema = z.object({
  groups: z.record(
    z.string(),
    z.object({
      inviteCode: z.string(),
      /** The highest `seq` given out. */
      head: z.number(),
      members: z.array(z.string()),
      ops: z.array(storedOpSchema),
    }),
  ),
  /** Op id to the group that holds it: the `unique (id)` index. */
  opGroup: z.record(z.string(), z.string()),
  /** Email to the user it signs in, standing in for Supabase Auth. */
  emails: z.record(z.string(), z.string()),
});

export type StoredOp = z.infer<typeof storedOpSchema>;
export type ServerState = z.infer<typeof serverStateSchema>;

/** What a phone sends for one op. The server stamps the rest. */
export interface IncomingOp {
  id: string;
  at: string;
  change: unknown;
}

interface Step<T> {
  state: ServerState;
  reply: Result<T>;
}

const EMPTY_STATE: ServerState = { groups: {}, opGroup: {}, emails: {} };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const INVITE_CODE = /^[A-Za-z0-9_-]{22,64}$/;

function ok<T>(state: ServerState, value: T): Step<T> {
  return { state, reply: { ok: true, value } };
}

function failed<T>(state: ServerState, message: string): Step<T> {
  return { state, reply: { ok: false, failure: { kind: 'failed', message } } };
}

function withMember(state: ServerState, groupId: string, userId: string): ServerState {
  const group = state.groups[groupId];
  if (group.members.includes(userId)) return state;
  return {
    ...state,
    groups: { ...state.groups, [groupId]: { ...group, members: [...group.members, userId] } },
  };
}

function isAcceptable(op: IncomingOp): boolean {
  return (
    UUID.test(op.id) &&
    !Number.isNaN(Date.parse(op.at)) &&
    typeof op.change === 'object' &&
    op.change !== null &&
    !Array.isArray(op.change) &&
    changeBytes(op.change) <= MAX_CHANGE_BYTES
  );
}

/** `create_group`. The same id and code again is the same call; the id with another code gets nothing. */
export function createGroup(
  state: ServerState,
  caller: string,
  groupId: string,
  inviteCode: string,
): Step<void> {
  if (!UUID.test(groupId) || !INVITE_CODE.test(inviteCode)) {
    return failed(state, 'invalid_invite_code');
  }

  const existing = state.groups[groupId];
  if (existing) {
    return existing.inviteCode === inviteCode
      ? ok(withMember(state, groupId, caller), undefined)
      : failed(state, 'group_exists');
  }
  if (Object.values(state.groups).some((group) => group.inviteCode === inviteCode)) {
    return failed(state, 'group_exists');
  }

  const group = { inviteCode, head: 0, members: [caller], ops: [] };
  return ok({ ...state, groups: { ...state.groups, [groupId]: group } }, undefined);
}

/** `join_group`. */
export function joinGroup(state: ServerState, caller: string, inviteCode: string): Step<string> {
  const groupId = Object.keys(state.groups).find(
    (id) => state.groups[id].inviteCode === inviteCode,
  );
  if (groupId === undefined) {
    return { state, reply: { ok: false, failure: { kind: 'invite-not-found' } } };
  }
  return ok(withMember(state, groupId, caller), groupId);
}

/** `append_ops`. One bad op never stops the ops around it. */
export function appendOps(
  state: ServerState,
  caller: string,
  groupId: string,
  incoming: readonly IncomingOp[],
): Step<{ accepted: string[]; rejected: string[] }> {
  const group = state.groups[groupId];
  // A group that does not exist reads the same as one the caller is not in.
  if (!group?.members.includes(caller)) {
    return { state, reply: { ok: false, failure: { kind: 'not-a-member' } } };
  }

  const accepted: string[] = [];
  const rejected: string[] = [];
  const ops = [...group.ops];
  const opGroup = { ...state.opGroup };
  let head = group.head;

  for (const op of incoming) {
    if (!isAcceptable(op)) {
      rejected.push(op.id);
      continue;
    }
    const owner = opGroup[op.id];
    if (owner !== undefined) {
      (owner === groupId ? accepted : rejected).push(op.id);
      continue;
    }
    head += 1;
    ops.push({ id: op.id, seq: head, at: op.at, change: op.change, userId: caller });
    opGroup[op.id] = groupId;
    accepted.push(op.id);
  }

  return ok(
    { ...state, opGroup, groups: { ...state.groups, [groupId]: { ...group, head, ops } } },
    { accepted, rejected },
  );
}

/**
 * `select ... from ops where group_id = ? and seq > ? order by seq limit ?` under row level
 * security: someone outside the group gets no rows and no error.
 */
export function opsAfter(
  state: ServerState,
  caller: string,
  groupId: string,
  afterSeq: number,
  limit: number,
): Step<StoredOp[]> {
  const group = state.groups[groupId];
  if (!group?.members.includes(caller)) return ok(state, []);
  return ok(state, group.ops.filter((op) => op.seq > afterSeq).slice(0, limit));
}

/** `my_groups`. */
export function myGroups(
  state: ServerState,
  caller: string,
): Step<Array<{ groupId: string; inviteCode: string }>> {
  return ok(
    state,
    Object.entries(state.groups).flatMap(([groupId, group]) =>
      group.members.includes(caller) ? [{ groupId, inviteCode: group.inviteCode }] : [],
    ),
  );
}

/** The user an email signs in, or null when no account has it. */
export function emailOwner(state: ServerState, email: string): Step<string | null> {
  return ok(state, state.emails[normaliseEmail(email)] ?? null);
}

/** Attaches the email to the user unless an account already has it, and says whose it is now. */
export function claimEmail(state: ServerState, email: string, userId: string): Step<string> {
  const key = normaliseEmail(email);
  const owner = state.emails[key];
  if (owner !== undefined) return ok(state, owner);
  return ok({ ...state, emails: { ...state.emails, [key]: userId } }, userId);
}

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Where the state lives, and how a tab hears that a group changed. */
export interface ServerStore {
  /** Runs one rule alone against the latest state and keeps the state it returns. */
  transact<T>(rule: (state: ServerState) => Step<T>): Promise<Result<T>>;
  announce(groupId: string): void;
  subscribe(groupId: string, onPoke: () => void): () => void;
}

export interface FakeServer {
  createGroup(caller: string, groupId: string, inviteCode: string): Promise<Result<void>>;
  joinGroup(caller: string, inviteCode: string): Promise<Result<string>>;
  appendOps(
    caller: string,
    groupId: string,
    ops: readonly IncomingOp[],
  ): Promise<Result<{ accepted: string[]; rejected: string[] }>>;
  opsAfter(
    caller: string,
    groupId: string,
    afterSeq: number,
    limit: number,
  ): Promise<Result<StoredOp[]>>;
  myGroups(caller: string): Promise<Result<Array<{ groupId: string; inviteCode: string }>>>;
  emailOwner(email: string): Promise<Result<string | null>>;
  claimEmail(email: string, userId: string): Promise<Result<string>>;
  subscribe(groupId: string, onPoke: () => void): () => void;
}

function createFakeServer(store: ServerStore): FakeServer {
  return {
    createGroup: (caller, groupId, inviteCode) =>
      store.transact((state) => createGroup(state, caller, groupId, inviteCode)),
    joinGroup: (caller, inviteCode) =>
      store.transact((state) => joinGroup(state, caller, inviteCode)),
    async appendOps(caller, groupId, ops) {
      let inserted = false;
      const reply = await store.transact((state) => {
        const step = appendOps(state, caller, groupId, ops);
        inserted = step.state.groups[groupId]?.head !== state.groups[groupId]?.head;
        return step;
      });
      // Like Realtime, which reports inserts: a push that only repeated old ops is silent.
      if (inserted) store.announce(groupId);
      return reply;
    },
    opsAfter: (caller, groupId, afterSeq, limit) =>
      store.transact((state) => opsAfter(state, caller, groupId, afterSeq, limit)),
    myGroups: (caller) => store.transact((state) => myGroups(state, caller)),
    emailOwner: (email) => store.transact((state) => emailOwner(state, email)),
    claimEmail: (email, userId) => store.transact((state) => claimEmail(state, email, userId)),
    subscribe: store.subscribe,
  };
}

function createListeners() {
  const listeners = new Map<string, Set<() => void>>();
  return {
    notify(groupId: string) {
      for (const onPoke of listeners.get(groupId) ?? []) onPoke();
    },
    subscribe(groupId: string, onPoke: () => void) {
      const group = listeners.get(groupId) ?? new Set();
      listeners.set(groupId, group);
      group.add(onPoke);
      return () => {
        group.delete(onPoke);
      };
    },
  };
}

/** A server that lives as long as the object does. Phones in one test share it. */
export function createMemoryServer(): FakeServer {
  let state = EMPTY_STATE;
  const listeners = createListeners();

  return createFakeServer({
    async transact(rule) {
      const step = rule(state);
      state = step.state;
      return step.reply;
    },
    // After the caller's own reply, as a real poke would arrive.
    announce: (groupId) => queueMicrotask(() => listeners.notify(groupId)),
    subscribe: listeners.subscribe,
  });
}

const STATE_KEY = 'split.fakeServer.state';
const LOCK_NAME = 'split.fakeServer.lock';
const CHANNEL_NAME = 'split.fakeServer.pokes';

/**
 * The server for `pnpm dev`: every tab of this browser is a phone talking to it. A Web Lock
 * makes a transaction's read and write one step across tabs, and a BroadcastChannel carries the
 * pokes between them.
 */
export function createLocalStorageServer(): FakeServer {
  const listeners = createListeners();
  const channel =
    typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME);
  channel?.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (typeof event.data === 'string') listeners.notify(event.data);
  });

  // Where Web Locks are missing, one tab still runs its own transactions in turn.
  let queue: Promise<unknown> = Promise.resolve();
  function alone<T>(work: () => Promise<T>): Promise<T> {
    if (typeof navigator !== 'undefined' && navigator.locks) {
      return navigator.locks.request(LOCK_NAME, work);
    }
    const run = queue.then(work);
    queue = run.catch(() => undefined);
    return run;
  }

  return createFakeServer({
    transact: (rule) =>
      alone(async () => {
        try {
          const raw = window.localStorage.getItem(STATE_KEY);
          const state = (raw === null ? null : parseJson(raw, serverStateSchema)) ?? EMPTY_STATE;
          const step = rule(state);
          if (step.state !== state) {
            window.localStorage.setItem(STATE_KEY, JSON.stringify(step.state));
          }
          return step.reply;
        } catch {
          return {
            ok: false,
            failure: { kind: 'failed', message: 'The fake server could not use localStorage.' },
          };
        }
      }),
    announce(groupId) {
      // A channel does not deliver to the tab that posted.
      queueMicrotask(() => listeners.notify(groupId));
      channel?.postMessage(groupId);
    },
    subscribe: listeners.subscribe,
  });
}
