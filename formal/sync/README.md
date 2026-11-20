# Group sync model

A TLA+ model of how group changes travel between phones: each tab's sync engine, the phone's `localStorage` that its tabs share, and the server's rules. TLC checks every order of steps within the bounds below. Run it with `pnpm formal:sync`. How to use it while changing the code: [.agents/skills/sync-engine-model/SKILL.md](../../.agents/skills/sync-engine-model/SKILL.md).

## Properties

| Name                  | In plain words                                                                                            | Harm if broken                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `ServerOrder`         | `group.created` is seq 1.                                                                                 | The fold ignores what comes before `group.created`, so a friend's first expense is lost. |
| `ExactlyOnce`         | No op is in the server log twice.                                                                         | An expense retried after a lost reply is counted twice.                                  |
| `ConfirmedIsPrefix`   | A phone's confirmed log is the server's log from seq 1 with no gaps.                                      | Phones fold different logs and show different balances.                                  |
| `NothingDropped`      | A submitted op is on the server or still queued on its phone, unless the server rejected it.              | An expense typed offline disappears.                                                     |
| `QuietMeansConverged` | When no engine has anything left to do, every phone holds the server's whole log and has an empty outbox. | A phone sits "synced" while missing friends' expenses, or its own.                       |
| `Delivered`           | Every op the server can take reaches it (temporal).                                                       | An expense never leaves the phone.                                                       |
| `Converges`           | Once people stop editing, every phone ends up holding the server's log (temporal).                        | Friends see different balances for good.                                                 |

`QuietMeansConverged` is the checkable core of `Converges` at the larger bounds: liveness checking is about 25 times slower in TLC, so the temporal properties run only in `Liveness`. `Quiet` cannot see a run that loops for ever; `Liveness` can.

## Models and bounds

| Model       | What it holds                                                                                                         | Faults                                            | Distinct states | Time   |
| ----------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | --------------- | ------ |
| `TwoTabs`   | Ana's phone with two tabs of the group open; ops `created`, `a1`; a friend outside the model writes `f1` at any time. | none                                              | 3.8 M           | ~1.5 m |
| `TwoPhones` | Ana and Ben, one tab each; Ben's `bTooBig` is rejected; Ben may open the link before the group exists.                | 2 lost requests/replies or failed pushes, 1 crash | 2.2 M           | ~25 s  |
| `Liveness`  | Ana (`created`, `a1`) and Ben (`b1`), one tab each, weak fairness for every engine.                                   | 1 fault, 1 crash                                  | 0.27 M          | ~1.3 m |

`PUSH_BATCH_SIZE` is 2 and `PULL_PAGE_SIZE` is 1 in every model, so multi-batch pushes and multi-page pulls happen. Times are on a 10-core laptop.

## Assumptions

- Each tab's synchronous JavaScript between two awaits is one step. Two tabs are two processes, so `deviceLog.confirm`'s read of the stored log and its write are two steps: another tab may write in between.
- Every insert pokes every open tab of every member phone, the sender's included. Supabase pokes again on every resubscribe, so a dropped socket delays a poke rather than losing it.
- A storage write reaches every other open tab of the phone as a `storage` event, in order.
- A locked-out tab (invite opens nothing) is eventually shown again or comes back online.
- One user per phone, never switching account; so the `reentering` step never runs.

## Broken variants

`formal/sync/run.sh --variants` checks that each property can fail. Each variant is one change to the code, made in the model by `Variant`:

| Variant                 | The change                                                                                | Fails                 | Counterexample      |
| ----------------------- | ----------------------------------------------------------------------------------------- | --------------------- | ------------------- |
| `no-idempotency`        | `append_ops` inserts an op id it already holds.                                           | `ExactlyOnce`         | 5 states            |
| `create-then-insert`    | `create_group` makes the group and its first op in two transactions.                      | `ServerOrder`         | 8 states            |
| `no-gap-cut`            | `deviceLog.confirm` keeps ops past a gap.                                                 | `ConfirmedIsPrefix`   | 23 states           |
| `drop-on-lost-reply`    | The engine drops a batch whose push reply was lost.                                       | `NothingDropped`      | 7 states            |
| `snapshot-shrink-check` | The engine before e215b90: a tab pulls again only if its last reload showed a longer log. | `QuietMeansConverged` | 39 states           |
| `no-retry-timer`        | A failed run arms no retry timer.                                                         | `Delivered`           | 10 states (a cycle) |
| `ignore-pokes`          | The engine ignores realtime pokes.                                                        | `Converges`           | 36 states (a cycle) |

## Not covered

Op contents and the fold, sessions and account switches (`reentering`), the unreadable-op reread, ops kept only in memory when storage is full, `forgetGroup`, retry wait lengths, more than two tabs or two phones, more than three ops per model.
