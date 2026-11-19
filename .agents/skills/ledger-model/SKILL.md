---
name: ledger-model
description: Property-check the group ledger fold (how a group's op log becomes the ledger, balances, settle-up and activity every phone shows) over generated op logs written by phones that each saw only part of the log. Use when a change touches src/features/group-ledger/logic/ fold.ts, entryLifecycle.ts, memberLifecycle.ts, claims.ts, balances.ts, settleUp.ts, post.ts or describe.ts, or the Change/Activity/Ledger types, and before trusting any change to conflicts, undo, restore, member merges or claims.
---

# Ledger model

The canonical state of a group is its op log (`docs/GROUP-LEDGER.md`). `foldLedger` turns it into what every phone shows, and nothing derived is stored, so a fold bug is a wrong balance or a lost edit on every phone at once. Example tests pick a handful of logs. This check runs the real `foldLedger`, `computeBalances` and `settleUp` over thousands of generated logs and checks what the fold promises on each.

The tool is [fast-check](https://fast-check.dev) inside Vitest, already a dev dependency. The question is whether the real code behaves for every input, and no verifier runs on this TypeScript, so the real code is tested with generated inputs instead of a hand model. Ordering across phones needs no model checker: the server's `seq` is the one order every phone folds, and the generator already reaches every interleaving that matters by letting each op's author see only a prefix of the log.

## Run it

```bash
pnpm formal:ledger           # every property, 10,000 logs each: about 20 s of CPU
pnpm formal:ledger:mutants   # breaks the code 9 ways and checks a property catches each: about 40 s of CPU
```

`pnpm test` runs the same suite with 100 logs each (about 0.2 s), so the normal suite stays fast. Set `LEDGER_RUNS` to choose another count. A failure prints fast-check's `seed`, `path` and the shrunk counterexample. To replay it, pass `{ seed, path }` to that `fc.assert` while you debug.

## What is checked

Suite: `src/features/group-ledger/logic/fold.properties.test.ts`.

| Property (the `it` name)                                                                                                 | Harm if it broke                                                                           |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| shows the same ledger, balances and activity on every phone holding the same confirmed log                               | Two friends see different balances or different activity for the same group.               |
| shows offline what it will show once the server takes those changes, if nobody else wrote                                | What you saved offline changes by itself when it syncs.                                    |
| keeps every balance adding up to zero, and settling up brings everyone to zero                                           | Money appears or disappears; settling up leaves someone owing.                             |
| never loses an edit silently: an op over a version its author never saw is flagged, and Restore brings that version back | Two friends edit one expense and one edit vanishes with no "replaced" row and no way back. |
| puts the ledger back as it was when the undo of the op just written is applied                                           | Undo leaves the ledger different from before, or moves the entry.                          |
| moves only the merged member's balance into the member it joins when every entry is in the group's currency              | Merging a duplicate friend changes a third person's balance or the group's total.          |
| lets no two phones be the same member while nobody merges members                                                        | Two phones both act as the same person.                                                    |

Two properties fail on the code today. They live in the `ledger fold properties the code breaks today` block as `it.fails`, each with its smallest counterexample as a fixed example, so they fail on every run:

- **Merge in a foreign currency moves a cent to a bystander.** A ¥3 expense, ¥1 each for m0, m1 and m2, paid by m0, at 0.005 SGD per yen, is 2 SGD cents. m2 is even. Merge m0 into m1 and m2 owes 1 cent. `entryEffect` rounds the converted total across the shares it is given, and a merge (`resolveEntry` in `fold.ts`) turns three shares into two.
- **A merge makes two phones the same member.** u2 claims m2, u0 claims m3, then m3 is merged into m2. `stepClaim` checks "first to claim keeps the member" only when a claim is made, so after the merge both phones are m2.

When a fix lands, its `it.fails` turns red. Change it to `it`, move it into the main block, and add its mutant.

### How the logs are made

`phoneLogArb` writes each op the way `sync/groupActions.ts` does: add, edit, remove, undo a row, Restore a replaced row (as `ActivityScreen.tsx` sends it), or any raw `Change` from `changeArb` in `testHelpers.ts`. The phone writing it has pulled only a random prefix of the log and still holds its own later ops as pending, so `base` is whatever that phone had on screen. That is how edits over unseen versions arise, as they do between real phones. `logArb` mixes these with `confirmedOpsArb` (any changes at all, unreadable ones included). Bounds: 3 phones, 4 member ids, up to 24 steps after the group is made and 2 to 4 members are added. About 30% of phone logs contain at least one replaced version.

### Assumptions, and what is left out

- The merge property only uses entries the expense form can post: what `others` paid never comes to more than the total (`paidInFull`; the form refuses "Paid too much"). The codec accepts an entry where it does, and then a merge can change who is counted as paying in `paidBy`, which caps `others` in id order.
- Undo is checked for the op just written, not for an older op after later ops touched the same thing.
- Not covered: the sync engine, device log storage and the server's ordering (`seq` is taken as given), `describe.ts` beyond activity wording being the same on every phone, `post.ts` construction (`codecRoundTrip.test.ts` and `post.test.ts` cover it), and `settleUp` minimality.

## Coverage record

Last synced at commit `0cfd319`: the properties were confirmed to describe these files as they were at that commit.

| File                                                                                       | Functions                                                               |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `src/features/group-ledger/logic/fold.ts`                                                  | `foldLedger`, `apply`, `resolveEntry`, `resolveBasis`, `resolveKeys`    |
| `src/features/group-ledger/logic/entryLifecycle.ts`                                        | `stepEntry`                                                             |
| `src/features/group-ledger/logic/memberLifecycle.ts`                                       | `stepMembers`, `resolveMember`, `activeMembers`                         |
| `src/features/group-ledger/logic/claims.ts`                                                | `stepClaim`                                                             |
| `src/features/group-ledger/logic/balances.ts`                                              | `entryEffect`, `computeBalances`                                        |
| `src/features/group-ledger/logic/post.ts`                                                  | `paidBy`, `totalCents`                                                  |
| `src/features/group-ledger/logic/settleUp.ts`                                              | `settleUp`                                                              |
| `src/features/group-ledger/logic/describe.ts`                                              | `describeActivity`                                                      |
| `src/features/group-ledger/sync/groupActions.ts`, `components/activity/ActivityScreen.tsx` | the ops the generator sends, mirrored by `intentChange` and `restoreOf` |

To see whether a change needs another look:

```bash
git log --oneline 0cfd319..HEAD -- src/features/group-ledger/logic src/features/group-ledger/domain/types.ts src/features/group-ledger/sync/groupActions.ts src/features/group-ledger/components/activity/ActivityScreen.tsx
```

Move the sync commit forward only after you have read those commits, confirmed the generator and properties still describe the code, and run both commands above.

## When it fails

1. Read the counterexample as steps: each op is `seq`, `userId` and `change`. Rebuild it as an example test with `confirmed`, `makeLog` and `fold` from `testHelpers.ts`, and check by hand what a person would expect to see.
2. **A bug in the code** when the expected outcome is what the docs and types promise (`docs/GROUP-LEDGER.md`, the comments on `Change` and `Activity`). Write the failing example test first, then fix the code.
3. **The check is out of date** when the change was intended: a new `Change` kind, a new action in `groupActions.ts`, a different Restore in `ActivityScreen.tsx`. Update `intentChange`, `restoreOf` or the property to describe the new behaviour, and say so in the commit. Never loosen a property so the current code passes. If the code breaks a promise, move the property to the "breaks today" block with its counterexample.
4. **A mutant reports STALE** when the code it mutates was reworded. Update `from`/`to` in `.agents/skills/ledger-model/scripts/mutants.mjs` to break the same rule in the new code. **MISSED** means a property no longer catches that break: strengthen the generator or the property until it does. **CRASH** means the mutant stopped the file loading, which proves nothing: pick a mutation that still runs.

## The conflict chart

`statechart/` holds a small TLA+ model of two friends changing one expense (`stepEntry`, Restore and the delete toast's Undo), drawn as the chart in `docs/flows/conflicts.md`. Run it and read its result with the pstack `/statechart` skill. When `stepEntry` or the Restore button changes, update `conflicts.tla` to match, rerun, and paste the new chart into the doc. The model's `knowing` set is worked out from `base` apart from the code's flag (`Unseen`), so the rule can fail; keep it that way.

This file lives in `.agents/skills/ledger-model/`, and `.claude/skills/ledger-model` is a symlink to it, so edit the `.agents/` copy.
