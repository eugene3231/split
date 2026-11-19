import { z } from 'zod';
import type { Result } from '@features/group-ledger/backend/port';
import { changeBytes, MAX_CHANGE_BYTES } from '@features/group-ledger/backend/limits';
import { parseJson } from '@features/split-workspace/logic/jsonStorage';

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
      head: z.number(),
      members: z.array(z.string()),
      ops: z.array(storedOpSchema),
    }),
  ),
  opGroup: z.record(z.string(), z.string()),
  emails: z.record(z.string(), z.string()),
});

export type StoredOp = z.infer<typeof storedOpSchema>;
export type ServerState = z.infer<typeof serverStateSchema>;

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

export function createGroup(
  state: ServerState,
  caller: string,
  groupId: string,
  inviteCode: string,
  firstOp: IncomingOp,
): Step<void> {
  if (!UUID.test(groupId) || !INVITE_CODE.test(inviteCode)) {
    return failed(state, 'invalid_invite_code');
  }

  const existing = state.groups[groupId];
  if (existing && existing.inviteCode !== inviteCode) return failed(state, 'group_exists');
  if (!existing && Object.values(state.groups).some((group) => group.inviteCode === inviteCode)) {
    return failed(state, 'group_exists');
  }

  const group = existing ?? { inviteCode, head: 0, members: [], ops: [] };
  const entered = withMember(
    { ...state, groups: { ...state.groups, [groupId]: group } },
    groupId,
    caller,
  );
  if (group.head > 0) return ok(entered, undefined);

  if (!isAcceptable(firstOp) || state.opGroup[firstOp.id] !== undefined) {
    return failed(state, 'invalid_first_op');
  }
  const first = { id: firstOp.id, seq: 1, at: firstOp.at, change: firstOp.change, userId: caller };
  return ok(
    {
      ...entered,
      opGroup: { ...state.opGroup, [firstOp.id]: groupId },
      groups: {
        ...entered.groups,
        [groupId]: { ...entered.groups[groupId], head: 1, ops: [first] },
      },
    },
    undefined,
  );
}

export function joinGroup(state: ServerState, caller: string, inviteCode: string): Step<string> {
  const groupId = Object.keys(state.groups).find(
    (id) => state.groups[id].inviteCode === inviteCode,
  );
  if (groupId === undefined) {
    return { state, reply: { ok: false, failure: { kind: 'invite-not-found' } } };
  }
  return ok(withMember(state, groupId, caller), groupId);
}

export function appendOps(
  state: ServerState,
  caller: string,
  groupId: string,
  incoming: readonly IncomingOp[],
): Step<{ accepted: string[]; rejected: string[] }> {
  const group = state.groups[groupId];
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

export function emailOwner(state: ServerState, email: string): Step<string | null> {
  return ok(state, state.emails[normaliseEmail(email)] ?? null);
}

export function claimEmail(state: ServerState, email: string, userId: string): Step<string> {
  const key = normaliseEmail(email);
  const owner = state.emails[key];
  if (owner !== undefined) return ok(state, owner);
  return ok({ ...state, emails: { ...state.emails, [key]: userId } }, userId);
}

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface ServerStore {
  transact<T>(rule: (state: ServerState) => Step<T>): Promise<Result<T>>;
  announce(groupId: string): void;
  subscribe(groupId: string, onPoke: () => void): () => void;
}

export interface FakeServer {
  createGroup(
    caller: string,
    groupId: string,
    inviteCode: string,
    firstOp: IncomingOp,
  ): Promise<Result<void>>;
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
    createGroup: (caller, groupId, inviteCode, firstOp) =>
      store.transact((state) => createGroup(state, caller, groupId, inviteCode, firstOp)),
    joinGroup: (caller, inviteCode) =>
      store.transact((state) => joinGroup(state, caller, inviteCode)),
    async appendOps(caller, groupId, ops) {
      let inserted = false;
      const reply = await store.transact((state) => {
        const step = appendOps(state, caller, groupId, ops);
        inserted = step.state.groups[groupId]?.head !== state.groups[groupId]?.head;
        return step;
      });
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

export function createMemoryServer(): FakeServer {
  let state = EMPTY_STATE;
  const listeners = createListeners();

  return createFakeServer({
    async transact(rule) {
      const step = rule(state);
      state = step.state;
      return step.reply;
    },
    announce: (groupId) => queueMicrotask(() => listeners.notify(groupId)),
    subscribe: listeners.subscribe,
  });
}

const STATE_KEY = 'split.fakeServer.state';
const LOCK_NAME = 'split.fakeServer.lock';
const CHANNEL_NAME = 'split.fakeServer.pokes';

export function createLocalStorageServer(): FakeServer {
  const listeners = createListeners();
  const channel =
    typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME);
  channel?.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (typeof event.data === 'string') listeners.notify(event.data);
  });

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
