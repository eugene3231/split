import type { ConfirmedOp, OpId, UserId } from '@features/group-ledger/domain/types';
import { PUSH_BATCH_SIZE } from '@features/group-ledger/backend/limits';
import type {
  BackendFailure,
  Pulled,
  PushOutcome,
  Result,
  Session,
} from '@features/group-ledger/backend/port';
import type { OutboxOp } from '@features/group-ledger/sync/deviceLog';

/**
 * Every state a group's sync engine can be in, and every way it moves between them. `stepSync`
 * is the whole of it: `groupSync.ts` feeds it events and carries out the effects it returns.
 * The model in `formal/sync/` checks this file's rules; keep the two in step.
 */

export type SyncState =
  | 'idle'
  | 'syncing'
  /** No connection. Retries on a timer and when the phone comes back online. */
  | 'offline'
  /** The server failed. Retries on a timer. */
  | 'error'
  /** The invite code no longer opens the group. No timer; the next request runs again. */
  | 'not-a-member';

/** One run: who am I, enter the group if needed, push the outbox, pull to the head. */
export type RunStep =
  | { at: 'session' }
  /** Creating or joining the group as `userId`, before pushing anything. */
  | { at: 'entering'; userId: UserId }
  | { at: 'pushing'; userId: UserId; batches: OutboxOp[][]; index: number; reentered: boolean }
  /** The server said this session is not a member mid-push. Rejoining once, then pushing `index` again. */
  | { at: 'reentering'; userId: UserId; batches: OutboxOp[][]; index: number }
  /** `pushFailure` is a `failed` push: the run still pulls, and ends as an error. */
  | { at: 'pulling'; afterSeq: number; pushFailure: BackendFailure | null }
  /** Storing the page of ops after `afterSeq` that ends at `last`. */
  | {
      at: 'confirming';
      afterSeq: number;
      last: number;
      more: boolean;
      pushFailure: BackendFailure | null;
    };

export type SyncPhase =
  /** Nothing running and nothing scheduled. */
  | { kind: 'idle' }
  /** `again`: something asked for a sync while this run was going. A run that works starts another. */
  | { kind: 'running'; again: boolean; step: RunStep }
  /** The last run failed; the retry timer is armed. */
  | { kind: 'waiting'; shown: 'offline' | 'error' }
  /** The invite code opens nothing. No timer. */
  | { kind: 'locked-out' }
  /** Final. Ignores every event, so a reply that lands late writes nothing. */
  | { kind: 'disposed' };

export interface SyncMachine {
  phase: SyncPhase;
  /** The next retry's wait. Doubles on each failure up to `LAST_RETRY_MS`; a run that works resets it. */
  retryMs: number;
  /** The first full pull starts at the first op this phone could not read, in case Split was updated. */
  rereadUnreadable: boolean;
  /**
   * The longest confirmed log this tab has seen stored. The stored log is shared by every tab and
   * only a stale write by another tab makes it shorter, so finding it shorter means pull again.
   */
  heldHead: number;
  lastSyncedAt: string | null;
  rejected: OpId[];
  outboxStuck: boolean;
}

export type SyncEvent =
  /** `syncNow()`, or a change submitted on this tab. */
  | { type: 'sync-asked' }
  /** The server says the group may have new ops. */
  | { type: 'poked' }
  | { type: 'online' }
  | { type: 'visibility'; visible: boolean }
  /**
   * Another tab wrote this group's log, and the engine reread it. `held` is how long the stored
   * confirmed log is now. `forgotten`: the group was taken off this phone.
   */
  | { type: 'other-tab-wrote'; forgotten: boolean; held: number; outboxGrew: boolean }
  | { type: 'retry-due' }
  | { type: 'session-replied'; result: Result<Session> }
  /** `failure` is null when the group was created or joined. */
  | { type: 'entered'; failure: BackendFailure | null }
  | { type: 'pushed'; result: Result<PushOutcome> }
  | { type: 'pulled'; result: Result<Pulled> }
  /** The confirm effect ran. `held` is how long the stored confirmed log is after it. */
  | { type: 'confirmed'; held: number }
  /** A backend call or a storage step threw. */
  | { type: 'threw'; message: string }
  | { type: 'disposed' };

export type SyncEffect =
  | { type: 'clear-retry' }
  | { type: 'arm-retry'; ms: number }
  | { type: 'ask-session' }
  | { type: 'tell-session'; session: Session }
  /** Publish the group if this phone made it and holds its `group.created`, else join with the code. */
  | { type: 'enter' }
  | { type: 'remember-member'; userId: UserId }
  | { type: 'push'; batch: OutboxOp[] }
  | { type: 'drop'; opIds: OpId[] }
  | { type: 'pull'; afterSeq: number }
  | { type: 'confirm'; ops: ConfirmedOp[] };

/** What a transition may read from the device log, at the moment it reads it. Writes are effects. */
export interface SyncReads {
  memberAs(): UserId | null;
  outbox(): OutboxOp[];
  confirmed(): ConfirmedOp[];
  now(): string;
}

export interface SyncStep {
  machine: SyncMachine;
  /** In order. A backend call is always last, so a step that throws never leaves one in flight. */
  effects: SyncEffect[];
}

export const FIRST_RETRY_MS = 2_000;
export const LAST_RETRY_MS = 60_000;

export const initialSyncMachine: SyncMachine = {
  phase: { kind: 'idle' },
  retryMs: FIRST_RETRY_MS,
  rereadUnreadable: true,
  heldHead: 0,
  lastSyncedAt: null,
  rejected: [],
  outboxStuck: false,
};

export function syncStateOf(phase: SyncPhase): SyncState {
  switch (phase.kind) {
    case 'running':
      return 'syncing';
    case 'waiting':
      return phase.shown;
    case 'locked-out':
      return 'not-a-member';
    case 'idle':
    case 'disposed':
      return 'idle';
  }
}

interface RunOutcome {
  failure: BackendFailure | null;
  /** The pull reached the head of the log, whatever became of the push. */
  reachedHead: boolean;
  outboxStuck: boolean;
}

const stay = (machine: SyncMachine): SyncStep => ({ machine, effects: [] });

function stopped(failure: BackendFailure): RunOutcome {
  return { failure, reachedHead: false, outboxStuck: false };
}

/** Starts a run now, or marks the running one to go again. */
function ask(machine: SyncMachine): SyncStep {
  const { phase } = machine;
  switch (phase.kind) {
    case 'disposed':
      return stay(machine);
    case 'running':
      return stay({ ...machine, phase: { ...phase, again: true } });
    case 'waiting':
      return {
        machine: { ...machine, phase: running() },
        effects: [{ type: 'clear-retry' }, { type: 'ask-session' }],
      };
    case 'idle':
    case 'locked-out':
      return { machine: { ...machine, phase: running() }, effects: [{ type: 'ask-session' }] };
  }
}

function running(): SyncPhase {
  return { kind: 'running', again: false, step: { at: 'session' } };
}

function withStep(machine: SyncMachine, again: boolean, step: RunStep): SyncMachine {
  return { ...machine, phase: { kind: 'running', again, step } };
}

/** Ends the run: decides what is shown, whether to retry, and whether to go again. */
function settle(
  machine: SyncMachine,
  again: boolean,
  outcome: RunOutcome,
  reads: SyncReads,
): SyncStep {
  const { failure, reachedHead, outboxStuck } = outcome;
  const lastSyncedAt = reachedHead ? reads.now() : machine.lastSyncedAt;
  const ended = { ...machine, lastSyncedAt, outboxStuck };
  if (failure === null) {
    const reset = { ...ended, retryMs: FIRST_RETRY_MS };
    if (again) return ask({ ...reset, phase: { kind: 'idle' } });
    return stay({ ...reset, phase: { kind: 'idle' } });
  }
  if (failure.kind === 'not-a-member' || failure.kind === 'invite-not-found') {
    return stay({ ...ended, phase: { kind: 'locked-out' } });
  }
  return {
    machine: {
      ...ended,
      phase: { kind: 'waiting', shown: failure.kind === 'offline' ? 'offline' : 'error' },
      retryMs: Math.min(machine.retryMs * 2, LAST_RETRY_MS),
    },
    effects: [{ type: 'arm-retry', ms: machine.retryMs }],
  };
}

function startPush(
  machine: SyncMachine,
  again: boolean,
  userId: UserId,
  reads: SyncReads,
): SyncStep {
  const outbox = reads.outbox();
  const batches: OutboxOp[][] = [];
  for (let start = 0; start < outbox.length; start += PUSH_BATCH_SIZE) {
    batches.push(outbox.slice(start, start + PUSH_BATCH_SIZE));
  }
  if (batches.length === 0) return startPull(machine, again, null, reads);
  return {
    machine: withStep(machine, again, {
      at: 'pushing',
      userId,
      batches,
      index: 0,
      reentered: false,
    }),
    effects: [{ type: 'push', batch: batches[0] }],
  };
}

function startPull(
  machine: SyncMachine,
  again: boolean,
  pushFailure: BackendFailure | null,
  reads: SyncReads,
): SyncStep {
  const confirmed = reads.confirmed();
  const firstUnreadable = machine.rereadUnreadable
    ? confirmed.find((op) => op.change === null)
    : undefined;
  const afterSeq = firstUnreadable ? firstUnreadable.seq - 1 : confirmed.length;
  return {
    machine: withStep(machine, again, { at: 'pulling', afterSeq, pushFailure }),
    effects: [{ type: 'pull', afterSeq }],
  };
}

/** A push failure other than `failed` ends the run; `failed` still pulls, with the outbox stuck. */
function pushFailed(
  machine: SyncMachine,
  again: boolean,
  failure: BackendFailure,
  reads: SyncReads,
): SyncStep {
  if (failure.kind !== 'failed') return settle(machine, again, stopped(failure), reads);
  return startPull(machine, again, failure, reads);
}

function reachedHead(
  machine: SyncMachine,
  again: boolean,
  pushFailure: BackendFailure | null,
  reads: SyncReads,
): SyncStep {
  const outcome = { failure: pushFailure, reachedHead: true, outboxStuck: pushFailure !== null };
  return settle({ ...machine, rereadUnreadable: false }, again, outcome, reads);
}

function stepRun(
  machine: SyncMachine,
  again: boolean,
  step: RunStep,
  event: SyncEvent,
  reads: SyncReads,
): SyncStep {
  if (event.type === 'threw') {
    return settle(machine, again, stopped({ kind: 'failed', message: event.message }), reads);
  }

  if (step.at === 'session' && event.type === 'session-replied') {
    if (!event.result.ok) return settle(machine, again, stopped(event.result.failure), reads);
    const session = event.result.value;
    const tell: SyncEffect = { type: 'tell-session', session };
    const next =
      reads.memberAs() === session.userId
        ? startPush(machine, again, session.userId, reads)
        : {
            machine: withStep(machine, again, { at: 'entering', userId: session.userId }),
            effects: [{ type: 'enter' } as const],
          };
    return { machine: next.machine, effects: [tell, ...next.effects] };
  }

  if (step.at === 'entering' && event.type === 'entered') {
    if (event.failure !== null) return settle(machine, again, stopped(event.failure), reads);
    const next = startPush(machine, again, step.userId, reads);
    return {
      machine: next.machine,
      effects: [{ type: 'remember-member', userId: step.userId }, ...next.effects],
    };
  }

  if (step.at === 'reentering' && event.type === 'entered') {
    if (event.failure !== null) return pushFailed(machine, again, event.failure, reads);
    const pushing = { ...step, at: 'pushing' as const, reentered: true };
    return {
      machine: withStep(machine, again, pushing),
      effects: [
        { type: 'remember-member', userId: step.userId },
        { type: 'push', batch: step.batches[step.index] },
      ],
    };
  }

  if (step.at === 'pushing' && event.type === 'pushed') {
    const { result } = event;
    if (!result.ok && result.failure.kind === 'not-a-member' && !step.reentered) {
      const { userId, batches, index } = step;
      return {
        machine: withStep(machine, again, { at: 'reentering', userId, batches, index }),
        effects: [{ type: 'enter' }],
      };
    }
    if (!result.ok) return pushFailed(machine, again, result.failure, reads);

    const { rejected } = result.value;
    const dropped =
      rejected.length > 0 ? { ...machine, rejected: [...machine.rejected, ...rejected] } : machine;
    const drop: SyncEffect[] = rejected.length > 0 ? [{ type: 'drop', opIds: rejected }] : [];
    const index = step.index + 1;
    const next =
      index < step.batches.length
        ? {
            machine: withStep(dropped, again, { ...step, index }),
            effects: [{ type: 'push', batch: step.batches[index] } as const],
          }
        : startPull(dropped, again, null, reads);
    return { machine: next.machine, effects: [...drop, ...next.effects] };
  }

  if (step.at === 'pulling' && event.type === 'pulled') {
    const { result } = event;
    if (!result.ok) {
      const failure = step.pushFailure ?? result.failure;
      const outcome = { failure, reachedHead: false, outboxStuck: step.pushFailure !== null };
      return settle(machine, again, outcome, reads);
    }
    const last = result.value.ops.at(-1);
    if (!last) return reachedHead(machine, again, step.pushFailure, reads);
    const { afterSeq, pushFailure } = step;
    const confirming = { at: 'confirming' as const, afterSeq, last: last.seq, pushFailure };
    return {
      machine: withStep(machine, again, { ...confirming, more: result.value.more }),
      effects: [{ type: 'confirm', ops: result.value.ops }],
    };
  }

  if (step.at === 'confirming' && event.type === 'confirmed') {
    const held = { ...machine, heldHead: Math.max(machine.heldHead, event.held) };
    const pull = (afterSeq: number): SyncStep => ({
      machine: withStep(held, again, { at: 'pulling', afterSeq, pushFailure: step.pushFailure }),
      effects: [{ type: 'pull', afterSeq }],
    });
    // Another tab wrote back a log shorter than where this page starts, so this tab's write
    // kept only the part before the gap. A store that is full leaves it at `afterSeq`: no retry.
    if (event.held < step.afterSeq) return pull(event.held);
    if (step.more) return pull(step.last);
    return reachedHead(held, again, step.pushFailure, reads);
  }

  return stay(machine);
}

/** The engine's one transition function. Pure but for `reads`; an event a state does not expect is ignored. */
export function stepSync(machine: SyncMachine, event: SyncEvent, reads: SyncReads): SyncStep {
  const { phase } = machine;
  if (phase.kind === 'disposed') return stay(machine);

  switch (event.type) {
    case 'disposed':
      return {
        machine: { ...machine, phase: { kind: 'disposed' } },
        effects: phase.kind === 'waiting' ? [{ type: 'clear-retry' }] : [],
      };
    case 'sync-asked':
    case 'poked':
    case 'online':
    case 'retry-due':
      return ask(machine);
    case 'visibility':
      return event.visible ? ask(machine) : stay(machine);
    case 'other-tab-wrote': {
      // Pull what a stale write left out, and send what another tab queued in case it closes.
      const missedOrQueued = event.held < machine.heldHead || event.outboxGrew;
      return !event.forgotten && missedOrQueued ? ask(machine) : stay(machine);
    }
    case 'session-replied':
    case 'entered':
    case 'pushed':
    case 'pulled':
    case 'confirmed':
    case 'threw':
      if (phase.kind !== 'running') return stay(machine);
      return stepRun(machine, phase.again, phase.step, event, reads);
  }
}
