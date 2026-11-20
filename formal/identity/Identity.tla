---------------------------- MODULE Identity ----------------------------
(***************************************************************************)
(* Identity, account and joining in Split's group ledger.                  *)
(*                                                                         *)
(* Phones each hold one backend session (Supabase keeps it in              *)
(* localStorage, so every tab of a phone shares it). Each tab has its own  *)
(* account store (`useAccountStore`) and its own sync engine per group     *)
(* (`groupSyncFor`). One group G exists on the server, made by Ben (user   *)
(* 0), who has claimed the member "ben". Ana's phones join it by invite    *)
(* link, claim a member, link an email, sign in on another phone and sign  *)
(* out.                                                                    *)
(*                                                                         *)
(* Each phone has two tabs. The "home" tab has the account sheet open      *)
(* (components/home/AccountSheet.tsx, the one caller of useAccount, so the *)
(* one tab that calls accountStore.load); it signs in and out and syncs    *)
(* the groups findGroups brings. The "group" tab opens the invite link,    *)
(* shows the group and claims a member; it learns the session only from    *)
(* its own sync runs (accountStore.adopt). Both run sync engines.          *)
(*                                                                         *)
(* Each action is one indivisible step of the code: the code between two   *)
(* awaits of one tab. Pointers are `file:function`, under                  *)
(* src/features/group-ledger/.                                             *)
(***************************************************************************)
EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS
  Phones,       \* e.g. {p1, p2}
  TwoTabs,      \* TRUE: a home tab and a group tab per phone. FALSE: one tab does both
  MaxUser,      \* new user ids are 1..MaxUser; Ben is 0
  MaxOps,       \* op ids the person's own claims may use; carrying names adds up to 4 more
  ClaimDuringSignIn, \* FALSE: nobody picks a name on the phone while its sign-in code is checked
  Members,      \* the group's members, e.g. {"ana", "ben"}
  Broken        \* "none", or a deliberately broken variant: "no-adopt", "sign-out-forgets",
                \* "no-find-add", "claim-steals", "no-reenter", "no-session-lock", "no-release",
                \* "reclaim-early", "reclaim-ignores-own"

Ben == 0
NoUser == -1
None == "none"
Users == 0..MaxUser
Authors == Users \cup {NoUser}   \* NoUser is THIS_DEVICE in logic/fold.ts
Home == "home"
GroupTab == IF TwoTabs THEN "group" ELSE Home
Tabs == {Home, GroupTab}
TabIds == Phones \X Tabs

VARIABLES
  \* ---- server (Supabase: auth.users, groups, ops) ----
  emailOwner,   \* the user that owns ana@example.com, or NoUser
  members,      \* users in G (group_members)
  slog,         \* G's op log after group.created: claims [id, a, m] in seq order
  nextUser,     \* next user id auth hands out
  nextOp,       \* next op id a phone makes (logic/ids.ts newOpId)
  \* ---- phone (localStorage, shared by its tabs) ----
  sess,         \* the backend session's user (supabase-js storage), or NoUser
  held,         \* G is in the joined-groups list (sync/joinedGroupsStore.ts)
  memberAs,     \* the user the device log entered G as (sync/deviceLog.ts memberAs)
  outbox,       \* pending claims [id, m] (deviceLog outbox)
  confirmed,    \* how much of slog the device log holds
  pulled,       \* the device log has G's group.created (useGroup: not "loading")
  \* ---- tab (one JS context) ----
  seen,         \* useAccountStore session: [u, linked]; u = NoUser before load
  upToDate,     \* ghost: this tab's code has read or written the session since it last changed
  acct,         \* email sign-in: [step, mode, linkUser] (sync/accountMachine.ts EmailSignIn)
  loadSt,       \* accountStore.load: "todo" (sheet opening, or signed out), "waiting" (on signInAnonymously), "done"
  anonWait,     \* supabaseBackend.loadSession found no session; signInAnonymously in flight
  find,         \* accountStore findGroups (adoptAccountGroups) is due
  run,          \* this tab's G engine: "none" | "start" | "waiting" | "read" | "entered" | "reenter" | "repush" | "pushed"
  runUser,      \* the userId groupSync.runOnce read at its start
  requested,    \* groupSync drain: another run was asked for
  syncSt,       \* GroupSnapshot.sync.state: "idle" | "not-a-member"
  join,         \* useJoinGroup on this tab: "none" | "joining" | "offline"
  \* ---- ghosts for the properties ----
  badStamp,     \* a change went out as a user other than the "you" its tab had seen
  everHeld,     \* the phone held G at some point
  signedInHad,  \* the phone signed in to the account while the account was in G
  replacedAnon, \* signInAnonymously replaced a session the phone had stored
  nameReplaced  \* carryNames.reclaim claimed for an account that already held another member

server == <<emailOwner, members, slog, nextUser, nextOp>>
phone == <<sess, held, memberAs, outbox, confirmed, pulled>>
tab == <<seen, upToDate, acct, loadSt, anonWait, find, run, runUser, requested, syncSt, join>>
ghost == <<badStamp, everHeld, signedInHad, replacedAnon, nameReplaced>>
vars == <<server, phone, tab, ghost>>

Linked(u) == u # NoUser /\ u = emailOwner
SessionOf(u) == [u |-> u, linked |-> Linked(u)]
NoSession == [u |-> NoUser, linked |-> FALSE]
\* accountMachine EmailSignIn idle. `carried` is the name carryNames.release gave up (sign-in).
Idle == [step |-> "idle", mode |-> None, linkUser |-> NoUser, carried |-> None]

(***************************************************************************)
(* logic/fold.ts foldLedger -> logic/claims.ts stepClaim: an author's claim *)
(* moves them to the member (or to nobody), unless another author holds    *)
(* it: the first to claim keeps a member. No merges here.                  *)
(***************************************************************************)
RECURSIVE FoldClaims(_, _)
FoldClaims(s, c) ==
  IF s = <<>> THEN c
  ELSE LET op == Head(s)
           heldByAnother == op.m # None /\ \E a \in Authors : a # op.a /\ c[a] = op.m
       IN FoldClaims(Tail(s),
            IF heldByAnother /\ Broken # "claim-steals" THEN c
            ELSE [c EXCEPT ![op.a] = op.m])

NoClaims == [a \in Authors |-> None]
ServerClaims == FoldClaims(slog, NoClaims)

\* The log a tab folds: confirmed ops by their authors, then pending ops as `self` (seen user).
TabLog(p, t) ==
  SubSeq(slog, 1, confirmed[p])
    \o [i \in 1..Len(outbox[p]) |-> [id |-> outbox[p][i].id, a |-> seen[<<p, t>>].u, m |-> outbox[p][i].m]]
TabClaims(p, t) == FoldClaims(TabLog(p, t), NoClaims)
Me(p, t) == TabClaims(p, t)[seen[<<p, t>>].u]
Taken(p, t) == {TabClaims(p, t)[a] : a \in Authors} \ {None}

(***************************************************************************)
(* sync/accountMachine.ts identityChange + become: the tab takes a         *)
(* session and looks for groups when the user changed or it is linked.     *)
(***************************************************************************)
Become(k, s) ==
  /\ seen' = [seen EXCEPT ![k] = s]
  /\ find' = [find EXCEPT ![k] =
        find[k] \/ (seen[k].u # NoUser /\ seen[k].u # s.u) \/ s.linked]

\* accountStep 'session-seen': ignored when it is the same session.
Adopt(k, s) ==
  IF seen[k] = s \/ Broken = "no-adopt" THEN UNCHANGED <<seen, find>> ELSE Become(k, s)

\* groupSync.syncNow: starts a run, or asks the running one for another.
SyncNowSet(k) ==
  /\ run' = [run EXCEPT ![k] = IF run[k] = "none" THEN "start" ELSE run[k]]
  /\ requested' = [requested EXCEPT ![k] = requested[k] \/ run[k] # "none"]

\* A change goes out as sess[p]. Did its tab show someone else as "you", having seen the session?
Stamp(p, t, u) ==
  badStamp' = (badStamp \/ (upToDate[<<p, t>>] /\ seen[<<p, t>>].u \notin {NoUser, u}))

\* An rpc first awaits this tab's session() (supabaseBackend.rpc), which is deduplicated per
\* tab: while this tab's own signInAnonymously is in flight, the call waits for it. Once it
\* resolves, the call goes out with whatever session the phone has stored by then.
HasSession(p, k) == sess[p] # NoUser /\ ~anonWait[k]

\* Tab k writes the phone's session. Its account store takes it in the same step when `learns`.
WriteSess(p, u, k, learns) ==
  /\ sess' = [sess EXCEPT ![p] = u]
  /\ upToDate' = [j \in TabIds |-> IF j = k THEN learns ELSE IF j[1] = p THEN FALSE ELSE upToDate[j]]

Init ==
  /\ emailOwner = NoUser
  /\ members = {Ben}
  /\ slog = << [id |-> 0, a |-> Ben, m |-> "ben"] >>
  /\ nextUser = 1
  /\ nextOp = 1
  /\ sess = [p \in Phones |-> NoUser]
  /\ held = [p \in Phones |-> FALSE]
  /\ memberAs = [p \in Phones |-> NoUser]
  /\ outbox = [p \in Phones |-> <<>>]
  /\ confirmed = [p \in Phones |-> 0]
  /\ pulled = [p \in Phones |-> FALSE]
  /\ seen = [k \in TabIds |-> NoSession]
  /\ upToDate = [k \in TabIds |-> TRUE]
  /\ acct = [k \in TabIds |-> Idle]
  /\ loadSt = [k \in TabIds |-> IF k[2] = Home THEN "todo" ELSE "done"]
  /\ anonWait = [k \in TabIds |-> FALSE]
  /\ find = [k \in TabIds |-> FALSE]
  /\ run = [k \in TabIds |-> "none"]
  /\ runUser = [k \in TabIds |-> NoUser]
  /\ requested = [k \in TabIds |-> FALSE]
  /\ syncSt = [k \in TabIds |-> "idle"]
  /\ join = [k \in TabIds |-> "none"]
  /\ badStamp = FALSE
  /\ everHeld = [p \in Phones |-> FALSE]
  /\ signedInHad = [p \in Phones |-> FALSE]
  /\ replacedAnon = FALSE
  /\ nameReplaced = FALSE

(***************************************************************************)
(* Sessions                                                                *)
(***************************************************************************)

\* Some call in this tab is waiting on session() (supabaseBackend.session, one per tab).
WaitsForSession(k) == loadSt[k] = "waiting" \/ run[k] = "waiting" \/ join[k] = "joining"

\* supabaseBackend.loadSession takes the phone-wide Web Lock `split.session`, getSession finds
\* none, and the tab calls signInAnonymously, still holding the lock (anonWait).
NeedSession(p, t) ==
  LET k == <<p, t>> IN
  /\ sess[p] = NoUser
  /\ ~anonWait[k]
  /\ WaitsForSession(k)
  /\ Broken = "no-session-lock" \/ \A j \in TabIds : j[1] = p => ~anonWait[j]
  /\ anonWait' = [anonWait EXCEPT ![k] = TRUE]
  /\ UNCHANGED <<server, phone, seen, upToDate, acct, loadSt, find, run, runUser, requested, syncSt, join, ghost>>

\* session() resolves with user u, and this tab's waiters continue in one microtask burst: the
\* load continuation (accountStore.load -> 'session-loaded') and the run continuation
\* (groupSync.runOnce -> onSession -> accountStore.adopt). A join's own rpc session() call is
\* not reported to the account store.
Resolve(k, u) ==
  /\ loadSt' = [loadSt EXCEPT ![k] = IF loadSt[k] = "waiting" THEN "done" ELSE loadSt[k]]
  /\ runUser' = [runUser EXCEPT ![k] = IF run[k] = "waiting" THEN u ELSE runUser[k]]
  /\ run' = [run EXCEPT ![k] = IF run[k] = "waiting" THEN "read" ELSE run[k]]
  /\ IF loadSt[k] = "waiting" \/ run[k] = "waiting"
       THEN Become(k, SessionOf(u))
       ELSE UNCHANGED <<seen, find>>

\* signInAnonymously resolves: a new user is stored and the lock is released.
AnonSignedIn(p, t) ==
  LET k == <<p, t>>
      u == nextUser
  IN
  /\ anonWait[k]
  /\ nextUser <= MaxUser
  /\ nextUser' = nextUser + 1
  /\ WriteSess(p, u, k, loadSt[k] = "waiting" \/ run[k] = "waiting")
  /\ anonWait' = [anonWait EXCEPT ![k] = FALSE]
  /\ Resolve(k, u)
  /\ replacedAnon' = (replacedAnon \/ sess[p] # NoUser)
  /\ UNCHANGED <<emailOwner, members, slog, nextOp, held, memberAs, outbox, confirmed, pulled,
                 acct, requested, syncSt, join, badStamp, everHeld, signedInHad, nameReplaced>>

\* getSession finds the session another tab stored, and this tab's waiters take it.
SessionFound(p, t) ==
  LET k == <<p, t>> IN
  /\ sess[p] # NoUser
  /\ ~anonWait[k]
  /\ loadSt[k] = "waiting" \/ run[k] = "waiting"
  /\ upToDate' = [upToDate EXCEPT ![k] = TRUE]
  /\ Resolve(k, sess[p])
  /\ UNCHANGED <<server, phone, acct, anonWait, requested, syncSt, join, ghost>>

\* hooks/useAccount: accountStore.load when the account sheet mounts, and after a sign-out.
\* With a stored session, getSession answers and the store takes it ('session-loaded' always
\* applies). Reopening the sheet later is left out: it repeats this step.
Load(p, t) ==
  LET k == <<p, t>> IN
  /\ loadSt[k] = "todo"
  /\ IF sess[p] # NoUser
       THEN /\ Become(k, SessionOf(sess[p]))
            /\ upToDate' = [upToDate EXCEPT ![k] = TRUE]
            /\ loadSt' = [loadSt EXCEPT ![k] = "done"]
       ELSE /\ loadSt' = [loadSt EXCEPT ![k] = "waiting"]
            /\ UNCHANGED <<seen, find, upToDate>>
  /\ UNCHANGED <<server, phone, acct, anonWait, run, runUser, requested, syncSt, join, ghost>>

(***************************************************************************)
(* Email (accountStore.startEmailSignIn / verifyEmailCode / signOut)       *)
(***************************************************************************)

\* supabaseBackend.startEmailSignIn: an anonymous user attaches a new email (updateUser);
\* an email that has an account gets a sign-in code. AccountSheet offers it only unlinked.
SendCode(p, t) ==
  LET k == <<p, t>> IN
  /\ acct[k].step = "idle"
  /\ loadSt[k] = "done"
  /\ HasSession(p, k)
  /\ ~seen[k].linked
  /\ ~Linked(sess[p])
  /\ acct' = [acct EXCEPT ![k] =
        IF emailOwner = NoUser
          THEN [Idle EXCEPT !.step = "code-sent", !.mode = "link", !.linkUser = sess[p]]
          ELSE [Idle EXCEPT !.step = "code-sent", !.mode = "sign-in"]]
  /\ UNCHANGED <<server, phone, seen, upToDate, loadSt, anonWait, find, run, runUser, requested,
                 syncSt, join, ghost>>

\* Link: verifyOtp (email_change) attaches the email to the user that asked, stores the session
\* it returns, and accountStore takes it ('code-accepted'). A wrong code changes nothing.
VerifyLink(p, t) ==
  LET k == <<p, t>>
      u == acct[k].linkUser
  IN
  /\ acct[k].step = "code-sent" /\ acct[k].mode = "link"
  /\ emailOwner = NoUser
  /\ emailOwner' = u
  /\ WriteSess(p, u, k, TRUE)
  /\ acct' = [acct EXCEPT ![k] = Idle]
  /\ Become(k, [u |-> u, linked |-> TRUE])
  /\ UNCHANGED <<members, slog, nextUser, nextOp, held, memberAs, outbox, confirmed, pulled,
                 loadSt, anonWait, run, runUser, requested, syncSt, join, ghost>>

\* Appends a member.claimed for m (None is "nobody") to the device log and syncs this tab's
\* engine: groupActions.claim -> GroupSync.submit, as sync/carryNames.ts `claim` does.
SubmitClaim(p, k, m) ==
  /\ outbox' = [outbox EXCEPT ![p] = Append(outbox[p], [id |-> nextOp, m |-> m])]
  /\ nextOp' = nextOp + 1
  /\ SyncNowSet(k)

\* Sign-in, accountStore.verifyEmailCode up to its first await: 'code-entered', then
\* carryNames.release as the user the store shows: the name it holds in G is given up
\* (member.claimed null), and every group's syncNow is awaited.
ReleaseNames(p, t) ==
  LET k == <<p, t>>
      m == IF held[p] /\ seen[k].u # NoUser THEN Me(p, t) ELSE None
  IN
  /\ acct[k].step = "code-sent" /\ acct[k].mode = "sign-in"
  /\ acct' = [acct EXCEPT ![k].step = "releasing", ![k].carried = m]
  /\ IF m # None /\ Broken # "no-release"
       THEN SubmitClaim(p, k, None)
       ELSE UNCHANGED <<outbox, nextOp, run, requested>>
  /\ UNCHANGED <<emailOwner, members, slog, nextUser, sess, held, memberAs, confirmed, pulled,
                 seen, upToDate, loadSt, anonWait, find, runUser, syncSt, join, ghost>>

\* The awaited syncs have ended (this tab's engine is no longer running). If a give-up is
\* still in the outbox, carryNames.restore claims the name back and the store refuses the
\* code as offline, without checking it.
ReleaseDone(p, t) ==
  LET k == <<p, t>>
      m == acct[k].carried
      sent == m = None \/ outbox[p] = <<>>
  IN
  /\ acct[k].step = "releasing"
  /\ run[k] = "none"
  /\ IF sent
       THEN /\ acct' = [acct EXCEPT ![k].step = "checking"]
            /\ UNCHANGED <<outbox, nextOp, run, requested>>
       ELSE /\ acct' = [acct EXCEPT ![k].step = "code-sent", ![k].carried = None]
            /\ SubmitClaim(p, k, m)
  /\ UNCHANGED <<emailOwner, members, slog, nextUser, sess, held, memberAs, confirmed, pulled,
                 seen, upToDate, loadSt, anonWait, find, runUser, syncSt, join, ghost>>

\* backend.verifyEmailCode refuses the code: carryNames.restore claims the name back as the
\* same user, and the store asks for the code again ('code-refused').
WrongCode(p, t) ==
  LET k == <<p, t>>
      m == acct[k].carried
  IN
  /\ acct[k].step = "checking"
  /\ acct' = [acct EXCEPT ![k].step = "code-sent", ![k].carried = None]
  /\ IF m # None THEN SubmitClaim(p, k, m) ELSE UNCHANGED <<outbox, nextOp, run, requested>>
  /\ UNCHANGED <<emailOwner, members, slog, nextUser, sess, held, memberAs, confirmed, pulled,
                 seen, upToDate, loadSt, anonWait, find, runUser, syncSt, join, ghost>>

\* verifyOtp (email) stores the account's session and the store takes it ('code-accepted'),
\* which asks for findGroups; the store then awaits it before reclaiming.
VerifySignIn(p, t) ==
  LET k == <<p, t>>
      u == emailOwner
  IN
  /\ acct[k].step = "checking"
  /\ WriteSess(p, u, k, TRUE)
  /\ acct' = [acct EXCEPT ![k].step = "finding"]
  /\ Become(k, [u |-> u, linked |-> TRUE])
  /\ signedInHad' = [signedInHad EXCEPT ![p] = signedInHad[p] \/ u \in members]
  /\ UNCHANGED <<emailOwner, members, slog, nextUser, nextOp, held, memberAs, outbox, confirmed,
                 pulled, loadSt, anonWait, run, runUser, requested, syncSt, join, badStamp,
                 everHeld, replacedAnon, nameReplaced>>

\* carryNames.reclaim, once findGroups (myGroups, then syncAllGroups awaited) has ended: fold
\* as the account; claim the carried name only if the account holds no member in G and
\* nobody holds the name. Records whether the account's name on the server gets replaced.
Reclaim(p, t) ==
  LET k == <<p, t>>
      m == acct[k].carried
      a == seen[k].u
      claims == m # None /\ (Me(p, t) = None \/ Broken = "reclaim-ignores-own")
                /\ m \notin Taken(p, t)
  IN
  /\ IF Broken = "reclaim-early"
       THEN acct[k].step \in {"finding", "syncing-all"}
       ELSE acct[k].step = "syncing-all" /\ run[k] = "none"
  /\ acct' = [acct EXCEPT ![k] = Idle]
  /\ IF claims THEN SubmitClaim(p, k, m) ELSE UNCHANGED <<outbox, nextOp, run, requested>>
  /\ nameReplaced' = (nameReplaced \/ (claims /\ ServerClaims[a] \notin {None, m}))
  /\ UNCHANGED <<emailOwner, members, slog, nextUser, sess, held, memberAs, confirmed, pulled,
                 seen, upToDate, loadSt, anonWait, find, runUser, syncSt, join, badStamp,
                 everHeld, signedInHad, replacedAnon>>

\* signOut({scope: 'local'}) drops the stored session, then accountStore calls load.
SignOut(p, t) ==
  LET k == <<p, t>> IN
  /\ acct[k].step = "idle"
  /\ loadSt[k] = "done"
  /\ seen[k].linked
  /\ HasSession(p, k)
  /\ WriteSess(p, NoUser, k, TRUE)
  /\ loadSt' = [loadSt EXCEPT ![k] = "todo"]
  /\ held' = IF Broken = "sign-out-forgets" THEN [held EXCEPT ![p] = FALSE] ELSE held
  /\ signedInHad' = [signedInHad EXCEPT ![p] = FALSE]
  /\ UNCHANGED <<server, memberAs, outbox, confirmed, pulled, seen, acct, anonWait, find, run,
                 runUser, requested, syncSt, join, badStamp, everHeld, replacedAnon, nameReplaced>>

\* sync/accountStore.ts adoptAccountGroups: myGroups as the phone's user adds what it is in,
\* then syncAllGroups. Assumes myGroups answers (no signal is not modelled here). A sign-in
\* waiting on it (verifyEmailCode awaits the 'code-accepted' dispatch) then waits for the syncs.
FindGroups(p, t) ==
  LET k == <<p, t>>
      nowHeld == held[p] \/ (sess[p] \in members /\ Broken # "no-find-add")
  IN
  /\ find[k]
  /\ HasSession(p, k)
  /\ find' = [find EXCEPT ![k] = FALSE]
  /\ held' = [held EXCEPT ![p] = nowHeld]
  /\ everHeld' = [everHeld EXCEPT ![p] = everHeld[p] \/ nowHeld]
  /\ IF nowHeld THEN SyncNowSet(k) ELSE UNCHANGED <<run, requested>>
  /\ acct' = IF acct[k].step = "finding" THEN [acct EXCEPT ![k].step = "syncing-all"] ELSE acct
  /\ UNCHANGED <<server, sess, memberAs, outbox, confirmed, pulled, seen, upToDate,
                 loadSt, anonWait, runUser, syncSt, join, badStamp, signedInHad, replacedAnon,
                 nameReplaced>>

(***************************************************************************)
(* Joining (hooks/useJoinGroup.ts) and claiming (components/group/WhoAreYou) *)
(***************************************************************************)

\* The invite link opens on a tab of a phone that does not hold G.
OpenLink(p, t) ==
  LET k == <<p, t>> IN
  /\ ~held[p]
  /\ join[k] = "none"
  /\ join' = [join EXCEPT ![k] = "joining"]
  /\ UNCHANGED <<server, phone, seen, upToDate, acct, loadSt, anonWait, find, run, runUser,
                 requested, syncSt, ghost>>

\* backend.joinGroup answers: in G as the phone's user, then held and synced.
Joined(p, t) ==
  LET k == <<p, t>> IN
  /\ join[k] = "joining"
  /\ HasSession(p, k)
  /\ members' = members \cup {sess[p]}
  /\ held' = [held EXCEPT ![p] = TRUE]
  /\ everHeld' = [everHeld EXCEPT ![p] = TRUE]
  /\ join' = [join EXCEPT ![k] = "none"]
  /\ SyncNowSet(k)
  /\ UNCHANGED <<emailOwner, slog, nextUser, nextOp, sess, memberAs, outbox, confirmed, pulled,
                 seen, upToDate, acct, loadSt, anonWait, find, runUser, syncSt, badStamp,
                 signedInHad, replacedAnon, nameReplaced>>

\* No signal: JoinScreen says joining needs a signal; "Try again" retries.
JoinOffline(p, t) ==
  LET k == <<p, t>> IN
  /\ join[k] = "joining"
  /\ join' = [join EXCEPT ![k] = "offline"]
  /\ UNCHANGED <<server, phone, seen, upToDate, acct, loadSt, anonWait, find, run, runUser,
                 requested, syncSt, ghost>>

RetryJoin(p, t) ==
  LET k == <<p, t>> IN
  /\ join[k] = "offline"
  /\ join' = [join EXCEPT ![k] = IF held[p] THEN "none" ELSE "joining"]
  /\ UNCHANGED <<server, phone, seen, upToDate, acct, loadSt, anonWait, find, run, runUser,
                 requested, syncSt, ghost>>

\* WhoAreYou: the group is open, this tab's user holds no member, and taps one nobody holds.
\* groupActions.claim -> GroupSync.submit stores it pending and syncs.
Claim(p, t, m) ==
  LET k == <<p, t>> IN
  /\ held[p] /\ pulled[p]
  /\ seen[k].u # NoUser
  /\ ClaimDuringSignIn \/ acct[<<p, Home>>].step \in {"idle", "code-sent"}
  /\ Me(p, t) = None
  /\ m \notin Taken(p, t)
  /\ outbox' = [outbox EXCEPT ![p] = Append(outbox[p], [id |-> nextOp, m |-> m])]
  /\ nextOp' = nextOp + 1
  /\ SyncNowSet(k)
  /\ UNCHANGED <<emailOwner, members, slog, nextUser, sess, held, memberAs, confirmed, pulled,
                 seen, upToDate, acct, loadSt, anonWait, find, runUser, syncSt, join, ghost>>

(***************************************************************************)
(* One run of groupSync.runOnce, step by step                              *)
(***************************************************************************)

\* await backend.session(), then onSession -> accountStore.adopt, synchronously.
RunRead(p, t) ==
  LET k == <<p, t>> IN
  /\ run[k] = "start"
  /\ IF sess[p] = NoUser
       THEN /\ run' = [run EXCEPT ![k] = "waiting"]
            /\ UNCHANGED <<runUser, seen, find, upToDate>>
       ELSE /\ run' = [run EXCEPT ![k] = "read"]
            /\ runUser' = [runUser EXCEPT ![k] = sess[p]]
            /\ upToDate' = [upToDate EXCEPT ![k] = TRUE]
            /\ Adopt(k, SessionOf(sess[p]))
  /\ UNCHANGED <<server, phone, acct, loadSt, anonWait, requested, syncSt, join, ghost>>

\* if (log.memberAs() !== userId) enterAsUser(): joinGroup goes out as the session now stored,
\* and the device log records the user the run read.
RunEnter(p, t) ==
  LET k == <<p, t>> IN
  /\ run[k] = "read"
  /\ HasSession(p, k)
  /\ run' = [run EXCEPT ![k] = "entered"]
  /\ IF memberAs[p] # runUser[k]
       THEN /\ members' = members \cup {sess[p]}
            /\ memberAs' = [memberAs EXCEPT ![p] = runUser[k]]
       ELSE UNCHANGED <<members, memberAs>>
  /\ UNCHANGED <<emailOwner, slog, nextUser, nextOp, sess, held, outbox, confirmed, pulled,
                 seen, upToDate, acct, loadSt, anonWait, find, runUser, requested, syncSt, join,
                 ghost>>

NotInLog(op) == \A i \in 1..Len(slog) : slog[i].id # op.id
Pushed(p) ==
  LET fresh == SelectSeq(outbox[p], NotInLog)
  IN slog \o [i \in 1..Len(fresh) |-> [id |-> fresh[i].id, a |-> sess[p], m |-> fresh[i].m]]

\* pushPending: append_ops as the stored session. not_a_member re-enters once.
RunPush(p, t) ==
  LET k == <<p, t>> IN
  /\ run[k] \in {"entered", "repush"}
  /\ HasSession(p, k)
  /\ IF outbox[p] = <<>>
       THEN /\ run' = [run EXCEPT ![k] = "pushed"]
            /\ UNCHANGED <<slog, badStamp, syncSt, requested>>
       ELSE IF sess[p] \in members
       THEN /\ slog' = Pushed(p)
            /\ Stamp(p, t, sess[p])
            /\ run' = [run EXCEPT ![k] = "pushed"]
            /\ UNCHANGED <<syncSt, requested>>
       ELSE IF run[k] = "entered" /\ Broken # "no-reenter"
       THEN /\ run' = [run EXCEPT ![k] = "reenter"]
            /\ UNCHANGED <<slog, badStamp, syncSt, requested>>
       \* settle: not-a-member, and drain drops a run asked for meanwhile.
       ELSE /\ run' = [run EXCEPT ![k] = "none"]
            /\ syncSt' = [syncSt EXCEPT ![k] = "not-a-member"]
            /\ requested' = [requested EXCEPT ![k] = FALSE]
            /\ UNCHANGED <<slog, badStamp>>
  /\ UNCHANGED <<emailOwner, members, nextUser, nextOp, phone, seen, upToDate, acct, loadSt,
                 anonWait, find, runUser, join, everHeld, signedInHad, replacedAnon, nameReplaced>>

\* pushPending's reenter = enterAsUser: joins as the stored session, records the run's user.
RunReenter(p, t) ==
  LET k == <<p, t>> IN
  /\ run[k] = "reenter"
  /\ HasSession(p, k)
  /\ members' = members \cup {sess[p]}
  /\ memberAs' = [memberAs EXCEPT ![p] = runUser[k]]
  /\ run' = [run EXCEPT ![k] = "repush"]
  /\ UNCHANGED <<emailOwner, slog, nextUser, nextOp, sess, held, outbox, confirmed, pulled,
                 seen, upToDate, acct, loadSt, anonWait, find, runUser, requested, syncSt, join,
                 ghost>>

\* pullToHead: row level security gives a non-member no rows and no error. Then settle, and
\* drain runs again if asked meanwhile.
RunPull(p, t) ==
  LET k == <<p, t>>
      member == sess[p] \in members
      inLog == {slog[i].id : i \in 1..Len(slog)}
      keep(op) == op.id \notin inLog
  IN
  /\ run[k] = "pushed"
  /\ HasSession(p, k)
  /\ confirmed' = [confirmed EXCEPT ![p] = IF member THEN Len(slog) ELSE confirmed[p]]
  /\ pulled' = [pulled EXCEPT ![p] = pulled[p] \/ member]
  /\ outbox' = [outbox EXCEPT ![p] = IF member THEN SelectSeq(outbox[p], keep) ELSE outbox[p]]
  /\ syncSt' = [syncSt EXCEPT ![k] = "idle"]
  /\ run' = [run EXCEPT ![k] = IF requested[k] THEN "start" ELSE "none"]
  /\ requested' = [requested EXCEPT ![k] = FALSE]
  /\ UNCHANGED <<server, sess, held, memberAs, seen, upToDate, acct, loadSt, anonWait, find,
                 runUser, join, ghost>>

Next ==
  \E p \in Phones :
    \/ Load(p, Home)
    \/ SendCode(p, Home)
    \/ VerifyLink(p, Home)
    \/ ReleaseNames(p, Home)
    \/ ReleaseDone(p, Home)
    \/ WrongCode(p, Home)
    \/ VerifySignIn(p, Home)
    \/ Reclaim(p, Home)
    \/ SignOut(p, Home)
    \/ OpenLink(p, GroupTab)
    \/ Joined(p, GroupTab)
    \/ JoinOffline(p, GroupTab)
    \/ RetryJoin(p, GroupTab)
    \/ \E m \in Members : Claim(p, GroupTab, m)
    \/ \E t \in Tabs :
         \/ NeedSession(p, t)
         \/ AnonSignedIn(p, t)
         \/ SessionFound(p, t)
         \/ FindGroups(p, t)
         \/ RunRead(p, t)
         \/ RunEnter(p, t)
         \/ RunPush(p, t)
         \/ RunReenter(p, t)
         \/ RunPull(p, t)

Spec == Init /\ [][Next]_vars

\* Phones start alike, so TLC checks one of each mirror image.
Symmetry == Permutations(Phones)

(***************************************************************************)
(* Properties                                                              *)
(***************************************************************************)

\* 1. The "you" a tab shows is who its changes go out as, once the tab has seen the session.
SentAsShown == ~badStamp

\* 2. A phone never loses a group it held, across sign-in, sign-out or a switch.
KeepsGroups == \A p \in Phones : everHeld[p] => held[p]

\* 3. After signing in on a phone, once it has finished looking, every group of the account
\*    is back on it.
Settled(p) == \A t \in Tabs : ~find[<<p, t>>] /\ ~anonWait[<<p, t>>] /\ loadSt[<<p, t>>] = "done"
GroupsComeBack ==
  \A p \in Phones : (signedInHad[p] /\ Settled(p)) => held[p]

\* 4. Two users never hold the same member.
OneHolderPerMember ==
  \A m \in Members : Cardinality({a \in Authors : ServerClaims[a] = m}) <= 1

\* 5. A held group never says its link stopped working (the invite code always opens G here).
LinkKeepsWorking ==
  \A p \in Phones, t \in Tabs : held[p] => syncSt[<<p, t>>] # "not-a-member"

\* 6. A member is never held by an anonymous user no phone is any longer: nobody could
\*    ever be that member again, and the person's own name shows as taken.
NoOrphanedMember ==
  \A a \in Users \ {Ben} :
    ServerClaims[a] # None => (Linked(a) \/ \E p \in Phones : sess[p] = a)

\* 7. A phone makes one anonymous user: signInAnonymously never replaces a stored session.
OneAnonymousUserPerPhone == ~replacedAnon

\* 8. Carrying a name over on sign-in never takes the account off a member it already holds.
CarryKeepsAccountName == ~nameReplaced

\* Release, restore and reclaim add ops on every try, so retrying a sign-in could grow the log
\* without end: TLC stops exploring past this many op ids.
OpBound == nextOp <= MaxOps + 4

TypeOK ==
  /\ sess \in [Phones -> Users \cup {NoUser}]
  /\ run \in [TabIds -> {"none", "start", "waiting", "read", "entered", "reenter", "repush", "pushed"}]
  /\ syncSt \in [TabIds -> {"idle", "not-a-member"}]
=============================================================================
