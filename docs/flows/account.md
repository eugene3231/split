# I keep my groups with my email

What a person sees when they tap "Keep your groups" on the home screen, on one phone: linking an email to this phone, signing in to an account the email already has (for example on a new phone) with the name they picked carried over, and signing out. Code: `components/home/AccountSheet.tsx`, `sync/accountMachine.ts`, `sync/accountStore.ts` (`verifyEmailCode`), `sync/carryNames.ts`, and the email steps in `backend/supabaseBackend.ts`, all under `src/features/group-ledger/`.

```mermaid
---
title: "I keep my groups with my email"
---
stateDiagram-v2
  state "Legend" as legend {
    lg0: phone
    lg1: code
    lg2: email
    lg3: Breaks YourNameStaysYours
    lg4: Breaks YourNameStaysYours in some cases
    lg5: Path to the YourNameStaysYours bug
  }
  class lg0 tan
  class lg1 blue
  class lg2 teal
  class lg3 breaks
  class lg4 mayBreak
  class lg5 bugPath
  s0: On this phone only
  s1: On this phone only, name picked
  s2: Sending the code
  s3: Code sent to the email
  s4: Checking the code
  s5: Signed in, groups and name coming back
  s6: Signed in with the email
  s7: Handing your name over
  s8: Checking the code, name handed over
  s9: Checking the code, a name picked meanwhile
  s10: Signed in, own name shows as Taken
  [*] --> s0
  s0 --> s1: you pick your name in a group
  s0 --> s2: you tap Keep my groups and enter your email
  s1 --> s2: you tap Keep my groups and enter your email
  s2 --> s3: a 6-digit code is emailed
  s3 --> s4: you enter the code
  s4 --> s3: the code is wrong
  s4 --> s6: the code is right [new email: it joins this phone]
  s3 --> s7: you enter the code
  s4 --> s5: the code is right [email has an account: the phone switches to it]
  s5 --> s6: the account's groups come back
  s6 --> s0: you sign out
  s7 --> s3: no signal: your name is taken back, try again
  s7 --> s8: the server has it
  s8 --> s3: the code is wrong
  s8 --> s9: you pick a name in another tab
  s8 --> s5: the code is right [email has an account: the phone switches to it]
  s9 --> s5: the code is right [email has an account: the phone switches to it]
  s5 --> s10: the account's groups come back
  s10 --> s0: you sign out
  classDef breaks fill:#ffecee,stroke:#e72e3b,stroke-width:2.5px,color:#cd2834
  classDef mayBreak fill:#fff3e6,stroke:#e8730c,stroke-width:2.5px,color:#b85a06
  class s0 tan
  class s0 mayBreak
  class s0 bugPath
  class s1 tan
  class s1 bugPath
  class s2 blue
  class s2 mayBreak
  class s2 bugPath
  class s3 blue
  class s3 mayBreak
  class s3 bugPath
  class s4 blue
  class s4 mayBreak
  class s5 teal
  class s5 mayBreak
  class s5 bugPath
  class s6 teal
  class s7 blue
  class s7 bugPath
  class s8 blue
  class s8 bugPath
  class s9 blue
  class s9 bugPath
  class s10 teal
  class s10 breaks
```

## What each state means for the person

| State                                      | What they see and what it means                                                                                                                                                                 |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| On this phone only                         | "Keep your groups". The phone is an anonymous user: its groups live on this phone and the server knows it only by that user.                                                                    |
| On this phone only, name picked            | The same, and in a group they have picked which member they are.                                                                                                                                |
| Sending the code                           | They entered an email. A new email is attached to this phone's user; an email that already has an account gets a sign-in code instead.                                                          |
| Code sent to the email                     | The sheet asks for the 6-digit code.                                                                                                                                                            |
| Checking the code                          | The code is with the server. A wrong one asks again.                                                                                                                                            |
| Handing your name over                     | Signing in to an existing account with a name picked: before the code is checked, the phone gives the name up as the user it is now, and waits for the server to take that.                     |
| Checking the code, name handed over        | The name is free for a moment. If the code is wrong, the phone picks it back as the same user.                                                                                                  |
| Checking the code, a name picked meanwhile | While the code was checked, they picked a name in another tab of this phone, as the user they are about to leave.                                                                               |
| Signed in, groups and name coming back     | The phone is now the account's user. The account's groups are added; then the handed-over name is picked again, as the account, unless the account already has a name in that group.            |
| Signed in with the email                   | "Your account". For a new email nothing else changed: same user, same groups, same names. When the account already had a name in the group, it keeps that one and the handed-over name is free. |
| Signed in, own name shows as Taken         | A name was left with the anonymous user they were, and the group asks "Who are you?" again with it shown as Taken.                                                                              |

Signing out makes the phone a new anonymous user. It keeps every group, and the names picked while signed in stay with the account: signing in again brings them back.

## Hidden steps

- The code can't be sent, and cancelling: both go back to where the person started, from any state before the code is checked.
- Picking a name while signed in: it belongs to the account and survives sign-out and sign-in.
- A wrong code after a name was picked meanwhile: it goes back to "Code sent to the email", like the other wrong-code arrows.
- Every tab of the phone shares one session. A tab that did not sign in learns of it the next time it syncs a group. The full model in `formal/identity/` checks that once a tab has seen the session, the changes it sends go out as the "you" it shows.

## Which rule breaks where

Rule `YourNameStaysYours`: "The name you picked in a group stays yours; it is never held by a user no phone is any more." Handing the name over before the switch keeps it in the plain case (since `6ff0a07`). It still breaks in "Signed in, own name shows as Taken" (red), reached only through "Checking the code, a name picked meanwhile". The orange states are where it can already be broken in some runs, because a stranded name stays stranded after signing out. The shortest path, as the report numbers it:

0. On this phone only
1. you pick your name in a group
2. you tap Keep my groups and enter your email
3. a 6-digit code is emailed
4. you enter the code: Handing your name over
5. the server has it: Checking the code, name handed over
6. you pick a name in another tab: Checking the code, a name picked meanwhile
7. the code is right [email has an account: the phone switches to it], and the account's groups come back

`carryNames.release` reads the names once, when the code is entered, so a name picked in another tab after that is not carried. The group tab shows "Who are you?" as soon as the name is handed over, which invites exactly this. The full model also finds that `reclaim` can move the account off a name it picked on another phone in the same moment; see `.agents/skills/identity-model/SKILL.md`.

The chart comes from `formal/flows/account/Account.tla` and its view; run the pstack `/statechart` skill on `Account.tla` with `Account.cfg` and `view.mjs` to draw it again.
