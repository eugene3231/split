# Group Ledger

A group is a running tab between friends ("Japan 2026", "Friday lunch"). Anyone in it adds what they paid from their own phone, offline or not, and everyone sees who owes whom. Joining takes a link and a name, with no account. Signing in with an email is optional and keeps your groups if you change phones. Product spec: issue #200, with #136 (several payers, settle up) and step 1 of #138 (installable app).

All of it lives in `src/features/group-ledger/`. The server is Supabase; without its env vars the app runs on a fake server kept in `localStorage`, so every flow works locally. Setup: [SUPABASE.md](SUPABASE.md).

## The data

The canonical state of a group is its **op log**: an append-only list of `Change`s (`domain/types.ts`). There is no expenses table, no balances table and no history table. The server orders ops and stores them; it never reads one.

| Change           | What it does                                                                     |
| ---------------- | -------------------------------------------------------------------------------- |
| `group.created`  | Names the group and fixes its currency. Only the first one counts.               |
| `group.renamed`  | Renames it.                                                                      |
| `member.put`     | Adds a member, or changes one (name, PayNow number, archived).                   |
| `member.merged`  | Two phones added the same friend offline; `from` now reads as `into`.            |
| `member.claimed` | "This device is that member." The server stamps who sent it.                     |
| `entry.put`      | Writes an expense or a transfer whole, with `base`, the revision its author saw. |
| `entry.removed`  | Removes an entry.                                                                |

`foldLedger(log, self)` turns a log into a `Ledger`: members, live entries, who this device is, and the activity list with an undo for each row. `computeBalances` and `settleUp` read the ledger. Nothing derived is stored.

### Expenses

An `ExpenseEntry` stores `owed`, each member's cents in the expense's currency, and `payment`, who paid. `owed` is worked out once, by `postWeights` (split evenly or by share weights), `postAmounts` (typed amounts, opening balances) or `postReceipt` (an itemised receipt through `computeSplit`). Those three are the only constructors. The total is the sum of `owed`.

This is the one place the design stores something it could derive, on purpose. An entry is a fact shared by phones that may run different versions of Split. If balances re-ran `computeSplit` on every read, a later change to charge rounding would make two phones in one group disagree, and archiving a member would change old receipts (`computeSplit` drops shares for people it isn't given). `basis` keeps the weights or the receipt so the entry reopens in the form that made it; balances never read it.

`Payment { payer, others }` means the payer covers the total less what the others put in. What was paid always adds up to the total, so no validator has to check it. Several payers (#136) is `others` with entries.

### Currency

A group has one currency, picked when it is made. An expense in another currency freezes `rate` when it is saved (prefilled from the live rates, editable). `entryEffect` converts the total once and allocates it twice, to payers and to owers, with `allocateCents`, so every entry nets to exactly zero in group cents. Transfers are always in the group currency. PayNow is offered only in SGD groups.

### Settling up

`settleUp(balances)` returns the fewest transfers. It is exact for up to 12 members with a non-zero balance (the fewest transfers is n minus the most zero-sum subsets the members split into) and greedy above that. Ties break by member id, so every phone shows the same list. "Mark paid" posts a `TransferEntry`.

## Sync

```
phone: GroupLog { confirmed (by seq), pending (by order) } ──push──▶ server: ops (group_id, seq, id, change, user_id)
       ▲                                                   ◀──pull── seq > max(confirmed.seq)
       └── foldLedger([...confirmed, ...pending not yet confirmed])
```

- **Writing.** `GroupSync.submit(change)` writes a `PendingOp` to the device log synchronously, so it survives a reload before any network call, then syncs.
- **Ordering.** `append_ops` locks the group row and gives each op the next `seq`, so commit order equals `seq` order and a puller can never skip a row. Phone clocks never order anything.
- **Retries.** The op id is made on the phone and is the server's idempotency key. Pushing an op twice stores it once and reports it accepted both times.
- **Crashes.** A pending op leaves the device log only when a pull brings it back confirmed. A crash at any step means the next sync pushes it again, harmlessly.
- **Conflicts.** Two phones edit one expense offline: the later `seq` wins the whole entry. The fold sees that its `base` was not the head it landed on, and the activity row reads "Ben's change replaced Ana's" with a one-tap restore. An edit beats a remove it never saw, and the row says so.
- **Two tabs.** Each pending op is its own storage key, so tabs never overwrite each other's outbox.
- **A failing push.** When the server fails this phone's changes, the run still pulls, so the group keeps up with everyone else. `sync.outboxStuck` is true until a push gets through, and the changes stay queued for the retry.
- **Rejected ops.** An op the server will never take (too large) is dropped from the outbox and shown, rather than blocking the ops behind it. Too large means over 64 KB as `changeBytes` counts it: the UTF-8 bytes of the change's JSON text. The Supabase adapter sends that text as a string and the SQL counts it before reading it, so the phone, the fake and Postgres agree to the byte. Screens call `fitsOnServer(change)` before they submit.
- **Unreadable ops.** An op a newer Split wrote is kept with `change: null`, so `seq` stays gapless, and the activity list says "update Split to see this change". A change with a field this version does not know is unreadable as a whole, so an older phone never drops the field and then erases it with an edit. An op queued on this phone that the app, after an update, can no longer read stays in the outbox, is sent as it was stored, and shows the same way.

## Identity and access

- **Device identity.** The first group action signs the device in anonymously (`supabase.auth.signInAnonymously`). That user is the device.
- **The link is the key.** An invite link is `/join#<code>`: 128 random bits, in the fragment so it never reaches a server log. The server finds the group by `sha256(code)` and shows the code itself to members only, so a member who signs in on a new phone can still share the link. `join_group(code)` adds the caller to the group. Row level security lets members read their groups' ops and nothing else. All writes go through security-definer functions.
- **Who you are in a group.** `member.claimed` in the log, stamped by the server with the sender's user id, so authorship can't be forged. Anyone can add a friend by name; the friend claims that name when they join.
- **Optional login.** "Keep my groups" sends an email code. A new email is attached to the anonymous user (`auth.updateUser`), so the user id and every group stay. An email that already has an account signs the device in to it, and the engine rejoins every group with the invite codes it holds. No server-side merge is needed because the code is the key.

## Where things live

```
src/shared/routing/            Route union, parseRoute, href, navigate, useRoute
src/shared/logic/core/allocation.ts   allocate, allocateCents (moved from split-workspace: both features use it)
src/features/group-ledger/
  domain/types.ts              the data above
  logic/                       pure: ids, codec (zod), fold, post, balances, settleUp, duplicates
  backend/                     port.ts, fake (memory + localStorage servers), supabase adapter, createBackend
  sync/                        deviceLog, groupSync engine, joinedGroups store, account store
  hooks/                       useGroup, useCreateGroup, useJoinGroup, useAccount
  components/                  screens and sheets for the routes below
src/features/split-workspace/  ReceiptEditor: the existing wizard with people fixed and a save slot
src/pages/                     one shell per route
supabase/migrations/           the schema, RLS and functions
```

Dependencies run one way: `group-ledger` imports `split-workspace` and `payments` through their barrels. `split-workspace` does not know groups exist. Its workspace store is scoped by a provider, so a receipt edited inside a group has its own draft key and never touches the quick split's draft.

## Routes

| Route                            | Shows                                                 |
| -------------------------------- | ----------------------------------------------------- |
| `/`                              | Your groups, New group, Quick split                   |
| `/split`                         | The existing wizard, unchanged, with its own draft    |
| `/join#<code>`                   | Joins, then asks who you are                          |
| `/g/:groupId`                    | Balances, then expenses; Add (quick or scan)          |
| `/g/:groupId/new`, `/e/:entryId` | Quick expense form, new or editing                    |
| `/g/:groupId/receipt[/:entryId]` | The receipt wizard for this group, then Save to group |
| `/g/:groupId/settle`             | Fewest transfers, PayNow, Mark paid                   |
| `/g/:groupId/activity`           | Who changed what, with restore                        |

Routing is a typed `Route` union with an exhaustive switch, about 80 lines. A router library would add more than it hides for flat routes with no loaders.

## Offline

The app is installable (manifest, icons, a service worker that precaches the shell, fonts bundled). Each group's log is in `localStorage`, so a group opens, and takes new expenses, with no signal. Pending changes sync when the phone is back online, when the tab becomes visible, and on a backoff timer.

## Decisions and alternatives

Four designs were sketched in parallel and cross-judged. All four chose an op log ordered by the server, with op ids made on the phone. This design takes the log and frozen `owed` from one, the scoped receipt editor, member merge and paging from another, the hashed invite code and locked-down functions from a third.

| Rejected                                     | Why                                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| Per-row tables with `updated_at`             | The activity list and restore need a second history table that can disagree with them. |
| Field-level patches                          | An expense's fields depend on each other; a merge can post an entry nobody wrote.      |
| Ordering by phone clocks                     | Clock skew picks winners; the server's `seq` is one order every phone agrees on.       |
| CRDT document (Yjs, Automerge)               | Same field-merge problem, and the activity list must be rebuilt from opaque updates.   |
| A hosted sync engine (PowerSync, Replicache) | Another service to run or pay for, and still row-based.                                |
| Re-deriving receipt shares on every read     | Balances would depend on the app version and on who is still a member.                 |

## Known limits

- The device log is in `localStorage` (about 5 MB). A group with around a thousand receipt edits would reach it; `sync/deviceLog.ts` is the only file that changes to move it to IndexedDB.
- iOS Safari may clear storage for a site that is not installed and not opened for seven days. Pending changes on such a phone would be lost; installed apps are exempt.
- The invite link can't be rotated yet. The schema stores a hash per group, so a "Reset link" is one function away.
