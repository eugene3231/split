import { describe, expect, it } from 'vitest';
import type { ConfirmedOp, OpId, UserId } from '@features/group-ledger/domain/types';
import type { BackendFailure, Session } from '@features/group-ledger/backend/port';
import type { OutboxOp } from '@features/group-ledger/sync/deviceLog';
import {
  FIRST_RETRY_MS,
  initialSyncMachine,
  LAST_RETRY_MS,
  stepSync,
  syncStateOf,
  type SyncEffect,
  type SyncEvent,
  type SyncMachine,
  type SyncReads,
} from '@features/group-ledger/sync/syncMachine';

const ana = 'user-ana' as UserId;
const session: Session = { userId: ana, account: { kind: 'anonymous' } };
const NOW = '2026-11-19T10:00:00.000Z';

function outboxOf(count: number): OutboxOp[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `op-${index}` as OpId,
    order: index + 1,
    at: NOW,
    change: { kind: 'group.renamed', name: `${index}` },
  }));
}

function confirmedOf(count: number, unreadableAt: number | null = null): ConfirmedOp[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `seq-${index + 1}` as OpId,
    seq: index + 1,
    at: NOW,
    change: index + 1 === unreadableAt ? null : { kind: 'group.renamed', name: `${index}` },
    userId: ana,
  }));
}

function reads(
  held: Partial<{ memberAs: UserId | null; outbox: OutboxOp[]; confirmed: ConfirmedOp[] }> = {},
): SyncReads {
  return {
    memberAs: () => (held.memberAs === undefined ? ana : held.memberAs),
    outbox: () => held.outbox ?? [],
    confirmed: () => held.confirmed ?? [],
    now: () => NOW,
  };
}

/** Runs the events in order and collects every effect. */
function drive(events: SyncEvent[], world = reads(), from: SyncMachine = initialSyncMachine) {
  let machine = from;
  const effects: SyncEffect[] = [];
  for (const event of events) {
    const step = stepSync(machine, event, world);
    machine = step.machine;
    effects.push(...step.effects);
  }
  return { machine, effects, state: syncStateOf(machine.phase) };
}

const asked: SyncEvent = { type: 'sync-asked' };
const sessionOk: SyncEvent = { type: 'session-replied', result: { ok: true, value: session } };
const pushedOk = (rejected: OpId[] = []): SyncEvent => ({
  type: 'pushed',
  result: { ok: true, value: { accepted: [], rejected } },
});
const pushFailed = (failure: BackendFailure): SyncEvent => ({
  type: 'pushed',
  result: { ok: false, failure },
});
const pulled = (ops: ConfirmedOp[], more = false): SyncEvent => ({
  type: 'pulled',
  result: { ok: true, value: { ops, more } },
});
const pullFailed = (failure: BackendFailure): SyncEvent => ({
  type: 'pulled',
  result: { ok: false, failure },
});
const stored = (held: number): SyncEvent => ({ type: 'confirmed', held });
const offline: BackendFailure = { kind: 'offline' };
const boom: BackendFailure = { kind: 'failed', message: 'boom' };

/** A run that fails at the session, from whatever state the machine is in. */
const failedRun = (failure: BackendFailure): SyncEvent[] => [
  asked,
  { type: 'session-replied', result: { ok: false, failure } },
];

describe('sync machine', () => {
  it('starts a run when asked, and asks for the session first', () => {
    const { machine, effects, state } = drive([asked]);

    expect(state).toBe('syncing');
    expect(machine.phase).toEqual({ kind: 'running', again: false, step: { at: 'session' } });
    expect(effects).toEqual([{ type: 'ask-session' }]);
  });

  it('marks a running run to go again rather than starting a second one', () => {
    const { machine, effects } = drive([asked, { type: 'poked' }, { type: 'online' }]);

    expect(machine.phase).toMatchObject({ kind: 'running', again: true });
    expect(effects).toEqual([{ type: 'ask-session' }]);
  });

  it('pushes the outbox in batches of 50, then pulls from the head it holds', () => {
    const world = reads({ outbox: outboxOf(120), confirmed: confirmedOf(3) });

    const { effects } = drive([asked, sessionOk, pushedOk(), pushedOk(), pushedOk()], world);

    expect(
      effects.map((effect) => (effect.type === 'push' ? effect.batch.length : effect.type)),
    ).toEqual(['ask-session', 'tell-session', 50, 50, 20, 'pull']);
    expect(effects.at(-1)).toEqual({ type: 'pull', afterSeq: 3 });
  });

  it('enters the group before pushing when the log was entered as someone else', () => {
    const world = reads({ memberAs: null, outbox: outboxOf(1) });

    const entering = drive([asked, sessionOk], world);
    const entered = drive([{ type: 'entered', failure: null }], world, entering.machine);

    expect(entering.effects.slice(1)).toEqual([
      { type: 'tell-session', session },
      { type: 'enter' },
    ]);
    expect(entered.effects).toEqual([
      { type: 'remember-member', userId: ana },
      { type: 'push', batch: outboxOf(1) },
    ]);
  });

  it('goes back to idle with the time it reached the head, confirming what it pulled', () => {
    const ops = confirmedOf(2);

    const { machine, effects, state } = drive([asked, sessionOk, pulled(ops), stored(2)]);

    expect(state).toBe('idle');
    expect(machine).toMatchObject({ lastSyncedAt: NOW, heldHead: 2 });
    expect(effects.slice(-2)).toEqual([
      { type: 'pull', afterSeq: 0 },
      { type: 'confirm', ops },
    ]);
  });

  it('pulls page after page while the server says there is more', () => {
    const { effects, state } = drive([asked, sessionOk, pulled(confirmedOf(2), true), stored(2)]);

    expect(state).toBe('syncing');
    expect(effects.at(-1)).toEqual({ type: 'pull', afterSeq: 2 });
  });

  it('pulls again from where the stored log ends when another tab cut it short under this page', () => {
    const page = confirmedOf(4).slice(2);
    const world = reads({ confirmed: confirmedOf(2) });

    const { effects, state } = drive([asked, sessionOk, pulled(page), stored(1)], world);

    expect(state).toBe('syncing');
    expect(effects.at(-1)).toEqual({ type: 'pull', afterSeq: 1 });
  });

  it('settles when its page could not be stored at all, rather than pulling in a loop', () => {
    const page = confirmedOf(4).slice(2);
    const world = reads({ confirmed: confirmedOf(2) });

    const { state } = drive([asked, sessionOk, pulled(page), stored(2)], world);

    expect(state).toBe('idle');
  });

  it('pulls from the first op it could not read, once', () => {
    const world = reads({ confirmed: confirmedOf(5, 3) });

    const first = drive([asked, sessionOk, pulled([])], world);
    const second = drive([asked, sessionOk], world, first.machine);

    expect(first.effects).toContainEqual({ type: 'pull', afterSeq: 2 });
    expect(second.effects.at(-1)).toEqual({ type: 'pull', afterSeq: 5 });
  });

  it('drops ops the server rejected and remembers them, and keeps going', () => {
    const world = reads({ outbox: outboxOf(1) });
    const tooBig = 'op-0' as OpId;

    const { machine, effects } = drive([asked, sessionOk, pushedOk([tooBig])], world);

    expect(machine.rejected).toEqual([tooBig]);
    expect(effects.slice(-2)).toEqual([
      { type: 'drop', opIds: [tooBig] },
      { type: 'pull', afterSeq: 0 },
    ]);
  });

  it('rejoins once when a push says it is not a member, then pushes the same batch again', () => {
    const world = reads({ outbox: outboxOf(1) });
    const notMember = pushFailed({ kind: 'not-a-member' });

    const rejoined = drive(
      [asked, sessionOk, notMember, { type: 'entered', failure: null }],
      world,
    );
    const again = drive([notMember], world, rejoined.machine);

    expect(rejoined.effects.slice(-3)).toEqual([
      { type: 'enter' },
      { type: 'remember-member', userId: ana },
      { type: 'push', batch: outboxOf(1) },
    ]);
    expect(again.state).toBe('not-a-member');
    expect(again.effects).toEqual([]);
  });

  it('still pulls when the server fails the push, then shows an error with the outbox stuck', () => {
    const world = reads({ outbox: outboxOf(1) });

    const { machine, effects, state } = drive(
      [asked, sessionOk, pushFailed(boom), pulled([])],
      world,
    );

    expect(effects).toContainEqual({ type: 'pull', afterSeq: 0 });
    expect(state).toBe('error');
    expect(machine).toMatchObject({ outboxStuck: true, lastSyncedAt: NOW });
    expect(effects.at(-1)).toEqual({ type: 'arm-retry', ms: FIRST_RETRY_MS });
  });

  it('stops without pulling when the push finds no connection', () => {
    const world = reads({ outbox: outboxOf(1) });

    const { machine, effects, state } = drive([asked, sessionOk, pushFailed(offline)], world);

    expect(state).toBe('offline');
    expect(machine.outboxStuck).toBe(false);
    expect(effects.some((effect) => effect.type === 'pull')).toBe(false);
  });

  it('reports the push failure over the pull failure when both fail', () => {
    const world = reads({ outbox: outboxOf(1) });

    const { state, machine } = drive(
      [asked, sessionOk, pushFailed(boom), pullFailed(offline)],
      world,
    );

    expect(state).toBe('error');
    expect(machine.lastSyncedAt).toBeNull();
  });

  it('backs off 2s, 4s, 8s up to a minute, and starts again at 2s after a run that works', () => {
    const arms = (machine: SyncMachine, runs: number) => {
      const waits: number[] = [];
      let at = machine;
      for (let run = 0; run < runs; run += 1) {
        const step = drive(failedRun(offline), reads(), at);
        at = step.machine;
        for (const effect of step.effects) if (effect.type === 'arm-retry') waits.push(effect.ms);
      }
      return { waits, at };
    };

    const failing = arms(initialSyncMachine, 7);
    const recovered = drive([asked, sessionOk, pulled([])], reads(), failing.at);
    const afterRecovery = arms(recovered.machine, 1);

    expect(failing.waits).toEqual([2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000]);
    expect(failing.at.retryMs).toBe(LAST_RETRY_MS);
    expect(afterRecovery.waits).toEqual([2_000]);
  });

  it('clears the retry timer when something asks for a sync while it waits', () => {
    const waiting = drive(failedRun(offline));

    const { effects } = drive([{ type: 'online' }], reads(), waiting.machine);

    expect(effects).toEqual([{ type: 'clear-retry' }, { type: 'ask-session' }]);
  });

  it('arms no timer when the invite opens nothing, and runs again when asked', () => {
    const lockedOut = drive(failedRun({ kind: 'invite-not-found' }));

    const asked2 = drive([{ type: 'poked' }], reads(), lockedOut.machine);

    expect(lockedOut.state).toBe('not-a-member');
    expect(lockedOut.effects.some((effect) => effect.type === 'arm-retry')).toBe(false);
    expect(asked2.effects).toEqual([{ type: 'ask-session' }]);
  });

  it('goes again at once after a run that worked when asked during it', () => {
    const { machine, effects } = drive([asked, sessionOk, asked, pulled([])]);

    expect(machine.phase).toEqual({ kind: 'running', again: false, step: { at: 'session' } });
    expect(effects.at(-1)).toEqual({ type: 'ask-session' });
  });

  it('forgets a request made during a run that failed, and leaves it to the timer', () => {
    const { state, effects } = drive([
      asked,
      asked,
      { type: 'session-replied', result: { ok: false, failure: offline } },
    ]);

    expect(state).toBe('offline');
    expect(effects.at(-1)).toEqual({ type: 'arm-retry', ms: FIRST_RETRY_MS });
  });

  it('ends the run as an error when a step throws', () => {
    const { state } = drive([asked, sessionOk, { type: 'threw', message: 'quota' }]);

    expect(state).toBe('error');
  });

  it('syncs when the tab is shown, and not when it is hidden', () => {
    expect(drive([{ type: 'visibility', visible: false }]).state).toBe('idle');
    expect(drive([{ type: 'visibility', visible: true }]).state).toBe('syncing');
  });

  it('syncs when another tab left the stored log shorter than it has seen, or queued a change, but not when the group was forgotten', () => {
    const synced = drive([asked, sessionOk, pulled(confirmedOf(3)), stored(3)]).machine;
    const wrote = (forgotten: boolean, held: number, outboxGrew: boolean) =>
      drive([{ type: 'other-tab-wrote', forgotten, held, outboxGrew }], reads(), synced).state;

    expect(wrote(false, 2, false)).toBe('syncing');
    expect(wrote(false, 3, true)).toBe('syncing');
    expect(wrote(false, 3, false)).toBe('idle');
    expect(wrote(true, 0, false)).toBe('idle');
  });

  it('ignores a reply the current state is not waiting for', () => {
    const idle = drive([pulled(confirmedOf(1))]);
    const atSession = drive([asked, pushedOk()]);

    expect(idle).toMatchObject({ state: 'idle', effects: [] });
    expect(atSession.machine.phase).toMatchObject({ step: { at: 'session' } });
  });

  it('once disposed, writes nothing and asks for nothing, whatever arrives', () => {
    const waiting = drive(failedRun(offline));
    const disposed = drive([{ type: 'disposed' }], reads(), waiting.machine);
    const midRun = drive([asked, sessionOk, { type: 'disposed' }, pulled(confirmedOf(1)), asked]);

    expect(disposed.effects).toEqual([{ type: 'clear-retry' }]);
    expect(midRun.machine.phase).toEqual({ kind: 'disposed' });
    expect(midRun.effects.some((effect) => effect.type === 'confirm')).toBe(false);
    expect(midRun.effects.filter((effect) => effect.type === 'ask-session')).toHaveLength(1);
  });
});
