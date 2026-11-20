---
name: sync-engine-model
description: Model-check Split's group sync (the sync machine, the device log shared by tabs, the server's seq and op-id rules) with TLA+ after changing it. Use when a change touches src/features/group-ledger/sync/syncMachine.ts, groupSync.ts, deviceLog.ts, backend/fakeServer.ts, backend/port.ts or the group ledger SQL, or to ask whether an op can be lost, duplicated, misordered or left unsynced.
---

# Sync engine model

`formal/sync/SyncEngine.tla` models two or three tabs on one or two phones, each running the group sync engine, sharing their phone's `localStorage`, and talking to the server over a network that loses requests and replies. TLC checks every order of steps within small bounds. The model is hand-written: it checks the code only while it describes the code, so a change to the covered code is a change to the model too.

The properties, in plain words, the bounds, the assumptions and the broken variants are in [formal/sync/README.md](../../../formal/sync/README.md). Read it first.

The skill lives in `.agents/skills/sync-engine-model/` so any harness can read it. `.claude/skills/sync-engine-model` is a symlink to it, so edit the `.agents/` copy.

## Last synced

The model describes the code at commit `1ebd03cbb1fcb70f4eef1f71b0357f9cd9524817`. To see what changed in covered code since:

```bash
git log --oneline 1ebd03cbb1fcb70f4eef1f71b0357f9cd9524817..HEAD -- \
  src/features/group-ledger/sync/syncMachine.ts src/features/group-ledger/sync/groupSync.ts \
  src/features/group-ledger/sync/deviceLog.ts src/features/group-ledger/backend/fakeServer.ts \
  src/features/group-ledger/backend/port.ts supabase/migrations/20261119120000_group_ledger.sql
```

Move the commit forward only after you have read each change, updated the model where it changed a covered step, and `pnpm formal:sync` passes.

## Coverage

Each model action is one step in the code that runs without an `await` in it, or one server transaction.

| Code                                                                     | Model                                                          |
| ------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `syncMachine.ts` `ask`                                                   | `Ask`                                                          |
| `syncMachine.ts` `settle`                                                | `Settle` (retry wait lengths and `rejected` abstracted)        |
| `syncMachine.ts` `startPush`, `startPull`, `pushFailed`                  | `StartPush`, `StartPull`, the `failed` branch of `PushReplied` |
| `syncMachine.ts` `stepRun` `session-replied`                             | `SessionReplied`                                               |
| `syncMachine.ts` `stepRun` `entered` (step `entering`)                   | `EnterReplied`                                                 |
| `syncMachine.ts` `stepRun` `pushed`                                      | `PushReplied`                                                  |
| `syncMachine.ts` `stepRun` `pulled`                                      | `PullReplied`                                                  |
| `syncMachine.ts` `stepRun` `confirmed`, `heldHead`                       | the end of `ConfirmWrite`                                      |
| `syncMachine.ts` `stepSync` `other-tab-wrote`                            | `StorageEvent`                                                 |
| `syncMachine.ts` `stepSync` `poked`, `retry-due`, `visibility`, `online` | `Poked`, `RetryDue`, `UserReturns` (locked-out tabs only)      |
| `groupSync.ts` `submit`                                                  | `Submit`                                                       |
| `groupSync.ts` `enter` (publish or join)                                 | the `publish` flag in `SessionReplied`                         |
| `groupSync.ts` `onStorage`, `reload`                                     | `StorageEvent`, `Reloaded`, `Hear`                             |
| `groupSync.ts` `dispose`, `groupSyncFor`                                 | `Crash`, `Reopen`                                              |
| `deviceLog.ts` `confirm`, `withoutGaps`                                  | `PullReplied` (the read), `ConfirmWrite` (the write), `Merge`  |
| `deviceLog.ts` `outbox`, `appendPending`, `drop`, `setMemberAs`          | `Ordered`, `Submit`, `PushReplied`, `EnterReplied`             |
| `fakeServer.ts` `createGroup`, SQL `create_group`                        | `ServerEnter` with `publish`                                   |
| `fakeServer.ts` `joinGroup`, SQL `join_group`                            | `ServerEnter` without `publish`                                |
| `fakeServer.ts` `appendOps`, SQL `append_ops`, `insert_op`               | `ServerPush`, `Append_`                                        |
| `fakeServer.ts` `opsAfter`, `fakeBackend.ts` `pull`                      | `ServerPull`                                                   |
| `fakeServer.ts` `announce`, `supabaseBackend.ts` `subscribe`             | `Poke`                                                         |
| `port.ts` `LedgerBackend` failures                                       | `Lose` (offline), `FailPush` (`failed`)                        |

Not covered: `reentering` (an account switch mid-push), `rereadUnreadable`, ops held only in memory (`unstored`), `forgetGroup` and the `forgotten` flag, `syncNow`'s promise, `outboxStuck` and `lastSyncedAt`.

## Check a change

1. Find which rows of the coverage table your diff touches. None: the model still holds; say so and stop.
2. Change the model's action to match the new code, step for step. A new `await` splits an action in two. A new read of storage in one tab, followed later by a write, is two actions, because another tab can write in between. Name new variables and actions after the code.
3. Run it:

   ```bash
   pnpm formal:sync                    # the three models, about 3 minutes; exit 0 when every property holds
   formal/sync/run.sh --variants       # each broken variant must print `caught`, about 1 minute
   ```

   It needs `java` and `tla2tools.jar` 1.7.4. With mise: `mise use -g java@temurin-25 http:tla2tools@1.7.4`. Otherwise set `JAVA` and `TLA2TOOLS_JAR`.

4. If a model fails, TLC's full output is in `formal/sync/out/<Model>.txt`. Read it with the pstack `/statechart` skill, which gives the shortest path to the broken property in plain words. Then decide which it is:
   - **A bug in the code.** The path is a sequence a real browser and server can produce. Write a failing test in `src/features/group-ledger/sync/groupSync.test.ts` or `syncMachine.test.ts` that follows the path, then fix the code. The two tests named "pulls again ... shorter log" are examples.
   - **A modeling error.** The path needs a step the code cannot take: two steps the model splits that the code runs without an `await` between, an action reading a variable the code does not read there, or a bound hit. Fix the model.

   Never weaken a property, add an assumption, or shrink a bound to make a failure go away without saying so in the README and your report.

5. If you added a guard to the code, add a variant that removes it: an `IF Variant = "<name>"` in the model and a line in `variants` in `run.sh` naming the property it must break. Run `--variants` and confirm it prints `caught`.
6. Update the README (bounds, times, variants), the coverage table, and the commit under Last synced.

## Known results

- Commit e215b90 fixed a bug this model found (variant `snapshot-shrink-check` is the code before it). Two tabs confirm at once; tab 2 writes back a stale, shorter log; tab 1's next `confirm` merges its page onto that shorter log, `withoutGaps` cuts it, and tab 1 reloads the cut log. When tab 2's `storage` event arrives, tab 1's last reload already shows the shorter log, so it sees no shrink and never pulls. Ana's own `a1` was then neither pending nor confirmed on her phone until the next poke, visibility change, or submit.
- The fix has two halves: a page whose write landed shorter than where the page starts pulls again at once, and a `storage` event that leaves the log shorter than the longest this tab has seen (`heldHead`) pulls again. With reliable pokes each half alone passes the model; the code keeps both.
