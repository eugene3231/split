---
name: identity-model
description: Model-check who a phone is in Split's group ledger (anonymous sign-in, linking an email, signing in on another phone, signing out, the cross-tab adopt, joining by invite, claiming a member) with the TLA+ model in formal/identity/. Use when a change touches the account store, the session code in either backend, joining, claiming, or how a sync run enters a group, or to ask "can a tab show the wrong you" or "can a phone lose a group or a member".
---

# Identity model

`formal/identity/Identity.tla` is a TLA+ model of phones, their tabs and one shared group. TLC checks every order of the steps below within the bounds, not just the orders a test happens to run. Run it from the repo root:

```bash
pnpm formal:identity                                    # every property, both configs, about 35 s
sh formal/identity/run.sh --only SentAsShown            # one property
sh formal/identity/run.sh --config TwoTabs --trace      # one config, full TLC states for each break
sh formal/identity/run.sh --broken no-adopt             # a deliberately broken variant
```

It needs Java and `tla2tools.jar` 1.7.4. The script takes them from mise (`mise install http:tla2tools@1.7.4 java`) or from `JAVA` and `TLA2TOOLS_JAR`. macOS's `/usr/bin/java` is a stub with no runtime, so mise's Java is preferred.

Exit 0 means every result matches `formal/identity/known-findings.txt`: the properties listed there break (open findings), everything else holds. Exit 1 means a property broke that should hold, or a known finding stopped breaking. Exit 2 is a model or setup error.

Read every result with the pstack `/statechart` skill: give it `formal/identity/Identity.tla` and a config, and it tells each shortest break as a path in plain words. The script prints the same paths as action names.

## What it checks

Two configs, because both phones with both tabs is too many states to check quickly (more than 30 million):

- `TwoTabs.cfg`: one phone with a home tab (account sheet open) and a group tab (invite link, group screen). Up to 3 users made by Auth, 2 claims. About 1.6 million states.
- `TwoPhones.cfg`: Ana's two phones, one tab each. Up to 2 users made by Auth, so no new user after a sign-out (TwoTabs covers that), 2 claims. About 540,000 states.

| Property                   | The promise, in plain words                                                                               | Harm if broken                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `SentAsShown`              | Once a tab has seen the phone's session, its changes go out as the user it shows as "you".                | The screen says you added it; the server says someone else did.   |
| `KeepsGroups`              | A phone never loses a group it held, across sign-in, sign-out or a switch.                                | A group disappears from the home list.                            |
| `GroupsComeBack`           | After signing in on a phone and looking for groups, every group the account was in is on the phone.       | A new phone does not show the account's groups.                   |
| `OneHolderPerMember`       | Two users never hold the same member.                                                                     | Two people's phones both say "you are Ana".                       |
| `LinkKeepsWorking`         | A held group never says the invite link stopped working (the model's invite code always opens the group). | "This link stopped working", or a not-a-member badge, by mistake. |
| `NoOrphanedMember`         | A member is never held by an anonymous user that no phone is any more.                                    | Your own name shows as "Taken" and nobody can ever pick it again. |
| `OneAnonymousUserPerPhone` | A phone makes one anonymous user: `signInAnonymously` never replaces a session it already stored.         | Whatever the first user did (joined, picked a name) is stranded.  |

Assumptions and what is left out:

- The backend is Supabase (`supabaseBackend.ts`): every tab of a phone shares one stored session, and row level security answers a pull by a non-member with no rows and no error. The fake backend makes its session in one synchronous step, so it can never show the two-tab races.
- Within one tab, the continuation after an await runs as one step with the code up to the next await. `groupSync.runOnce` reads the session and calls `onSession` -> `accountStore.adopt` in one step; `verifyEmailCode` stores the session and the store takes it in one step.
- The invite code always opens the group (no rotation, no bad code: `useJoinGroup` bad-link handling is checked by `logic/joinState.test.ts`, not here). No signal is modelled only for joining. `myGroups` always answers. Pushes are never rejected. Pull paging, realtime pokes, visibility and online events, retry timers, wrong codes, cancel, reopening the account sheet and `forgetGroup` are left out.
- One email (`ana@example.com`), one group made by Ben (user 0, who holds member "ben"), members `ana` and `ben`.

## Coverage, and when to rerun

The model describes these, under `src/features/group-ledger/`, as of commit `60cbbe2` (last synced). When any of them changes after that commit, reread the matching action in `Identity.tla`, update it, and rerun. Move the commit forward only after you have confirmed the model describes the code at the new commit.

| Code                                                                                                                       | Model                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `sync/accountMachine.ts` `accountStep`, `identityChange` (`session-seen`, `session-loaded`, `code-accepted`)               | `Become`, `Adopt`                                                                                |
| `sync/accountStore.ts` `load`, `adopt`, `startEmailSignIn`, `verifyEmailCode`, `signOut`, `adoptAccountGroups`             | `Load`, `RunRead` (adopt), `SendCode`, `VerifyCode`, `SignOut`, `FindGroups`                     |
| `backend/supabaseBackend.ts` `session`, `loadSession`, `startEmailSignIn`, `verifyEmailCode`, `signOut`, `rpc`             | `NeedSession`, `AnonSignedIn`, `SessionFound`, `HasSession`, `SendCode`, `VerifyCode`, `SignOut` |
| `hooks/useJoinGroup.ts` `useJoinGroup`                                                                                     | `OpenLink`, `Joined`, `JoinOffline`, `RetryJoin`                                                 |
| `components/group/WhoAreYou.tsx`, `components/group/gateScreen.ts` (`who-are-you`), `sync/groupActions.ts` claim           | `Claim`                                                                                          |
| `logic/fold.ts` `foldLedger` (`member.claimed`, `isHeldByAnother`, pending ops as `self`)                                  | `FoldClaims`, `TabLog`, `Me`, `Taken`                                                            |
| `sync/groupSync.ts` `runOnce`, `pushPending` (re-enter once on `not-a-member`), `pullToHead`, `settle`, `drain`, `syncNow` | `RunRead`, `RunEnter`, `RunPush`, `RunReenter`, `RunPull`, `SyncNowSet`                          |
| `sync/joinedGroupsStore.ts` `add`                                                                                          | `held` in `Joined`, `FindGroups`                                                                 |
| `components/home/AccountSheet.tsx` (the one caller of `useAccount`, so the one tab that calls `load`)                      | `Home` tab                                                                                       |

## A change touches covered code

1. Find the actions the change touches in the table. Read them next to the new code, and make the model do what the code now does, one action per stretch of code between two awaits.
2. Run `pnpm formal:identity`.
3. A property that newly breaks: read the path (with `/statechart`, or `--trace`). Replay it against the real code before you believe it, as a vitest test that drives the steps in that order (the fake backend works for anything that does not need two tabs racing for a session; wrap a backend method to change the stored session between steps, as `groupSync.test.ts` wraps backends). If the code really does it, it is a bug: report it, and fix it with a failing test first. If the code cannot do it, the model is wrong: fix the action, not the property.
4. Never weaken a property or a bound to make a run pass, and never add a line to `known-findings.txt` for a new break without reporting it as a finding.
5. A known finding that now holds: confirm the fix in the code, then remove its line.

To check that the model can still catch a break, run a broken variant. Each one changes one action the way a plausible code mistake would, and each breaks its property:

| `--broken`         | The mistake it stands for                                                      | Breaks                               |
| ------------------ | ------------------------------------------------------------------------------ | ------------------------------------ |
| `no-adopt`         | `accountStore.adopt` ignores the session a sync ran as                         | `SentAsShown` (both configs)         |
| `sign-out-forgets` | sign-out clears the joined-groups list                                         | `KeepsGroups` (both)                 |
| `no-find-add`      | `adoptAccountGroups` does not add the account's groups                         | `GroupsComeBack` (TwoPhones)         |
| `claim-steals`     | `foldLedger` drops the `isHeldByAnother` check                                 | `OneHolderPerMember` (TwoPhones)     |
| `no-reenter`       | `pushPending` does not re-enter on `not-a-member`                              | `LinkKeepsWorking` (both)            |
| `no-session-lock`  | `loadSession` without the `split.session` Web Lock (the code before `60cbbe2`) | `OneAnonymousUserPerPhone` (TwoTabs) |

## Known findings

Listed in `formal/identity/known-findings.txt`. Each was replayed against the real code.

**`NoOrphanedMember`: signing in to an existing account strands the member you picked as anonymous.** TwoPhones path: phone 2 opens the invite link and signs in anonymously as Z; Z joins and claims Ana; phone 1 links ana@example.com to its user U; phone 2 sends a code to ana@example.com (`sign-in` mode) and verifies it. Phone 2 is now U, who holds no member, so the group asks "who are you?" with Ana shown as Taken by Z, a user no phone is any more. TwoTabs finds the same on one phone: link the email, sign out, join and claim Ana as the new anonymous user, sign back in. This is the design in `docs/GROUP-LEDGER.md` ("the engine rejoins every group with the invite codes it holds"): it moves the groups but not the claims. Fixing it is a product decision (carry the anonymous user's claims over on sign-in, or merge users on the server).

**`LinkKeepsWorking`: a run whose session changes twice ends as not-a-member.** TwoTabs path: the group tab's run reads the session (user X, whom the device log entered as), then the home tab signs in to another account; the push as the new user gets `not-a-member`, `pushPending` re-enters with the invite code as that user, then the home tab signs out and a new anonymous user is stored; the second push gets `not-a-member` again and `settle` publishes `not-a-member`, which nothing retries until a poke, the tab becoming visible, or the phone coming online. The gate shows "This link stopped working" (for a group never opened) or the badge says not a member, though the link works. Rare: it needs two sign-in changes inside one sync run.

Fixed: **`OneAnonymousUserPerPhone`**, in `60cbbe2`. A new phone whose home tab and group tab both found no session made two anonymous users; whichever finished second replaced the first in storage, stranding the first user's join and claim (it also broke `NoOrphanedMember`). `loadSession` now holds the `split.session` Web Lock around reading and creating the session.
