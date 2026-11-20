------------------------------- MODULE SyncEngine -------------------------------
(***************************************************************************)
(* Split's group sync: phones with tabs, each tab running one sync engine  *)
(* (src/features/group-ledger/sync/syncMachine.ts, driven by groupSync.ts),*)
(* the phone's localStorage shared by its tabs (sync/deviceLog.ts), and    *)
(* the server's rules (backend/fakeServer.ts and the SQL in                *)
(* supabase/migrations/20261119120000_group_ledger.sql).                   *)
(*                                                                         *)
(* One action here is one step that runs without interruption in the     *)
(* code: a server transaction, or a tab's synchronous JS between two      *)
(* awaits. Each action names the code it stands for.                      *)
(*                                                                         *)
(* Abstracted: op contents (an op is its id), sessions and user ids (one  *)
(* user per phone, never switching account), retry wait lengths, the     *)
(* unreadable-op reread, memory-only ops when storage is full.            *)
(***************************************************************************)
EXTENDS Naturals, Sequences, FiniteSets

CONSTANTS
    Phones,      \* e.g. {"ana", "ben"}
    Tabs,        \* e.g. {"ana1", "ana2", "ben1"}
    PhoneOf,     \* [Tabs -> Phones]
    Creator,     \* the phone that made the group
    OpsOf,       \* [Phones -> Seq(op id)], in the order the phone submits them
    Created,     \* the group.created op: OpsOf[Creator][1], queued before any tab runs
    Bad,         \* ops the server rejects for good (too large)
    BatchSize,   \* PUSH_BATCH_SIZE (50 in backend/limits.ts)
    PageSize,    \* PULL_PAGE_SIZE (500 in backend/limits.ts)
    MaxFaults,   \* lost requests, lost replies and failed pushes, in all
    MaxCrashes,  \* tabs closed at any point (a crash, a reload, dispose)
    FriendOps,   \* ops a phone outside the model writes to the server, at any time once the group exists
    Variant      \* "code", or a broken variant: formal/sync/README.md lists them

AllOps == UNION {{OpsOf[p][i] : i \in 1..Len(OpsOf[p])} : p \in Phones}
Owner(op) == CHOOSE p \in Phones : \E i \in 1..Len(OpsOf[p]) : OpsOf[p][i] = op
Range(s) == {s[i] : i \in 1..Len(s)}

VARIABLES
    serverLog,   \* ops by seq: serverLog[n] is the op at seq n
    exists,      \* the groups row exists
    members,     \* phones in memberships
    outbox,      \* [Phones -> SUBSET AllOps]: the `out:<id>` keys
    confirmed,   \* [Phones -> Seq]: the `confirmed` key
    memberAs,    \* [Phones -> BOOLEAN]: the `member` key
    submitted,   \* [Phones -> Nat]: how many of OpsOf[p] the user has submitted
    tab,         \* [Tabs -> engine state, see Fresh]
    faults, crashes,
    friendWrote  \* how many of FriendOps the friend has written

vars == <<serverLog, exists, members, outbox, confirmed, memberAs, submitted, tab, faults, crashes, friendWrote>>

(* A request in flight, or its reply. st: none | sent | replied | lost | failed | confirming *)
NoNet == [st |-> "none", kind |-> "none", batch |-> <<>>, after |-> 0,
          ops |-> <<>>, more |-> FALSE, rejected |-> {}, ok |-> TRUE, publish |-> FALSE,
          readBuf |-> <<>>]
Send(kind, batch, after, publish) ==
    [NoNet EXCEPT !.st = "sent", !.kind = kind, !.batch = batch, !.after = after,
                  !.publish = publish]

(* syncMachine.ts SyncPhase and RunStep, plus groupSync.ts's snapshot and storage-event queue. *)
Fresh(p) ==
    [phase |-> "running", step |-> "session", again |-> FALSE,
     batches |-> <<>>, pushFailed |-> FALSE, net |-> NoNet,
     snapLen |-> Len(confirmed[p]), snapPending |-> Cardinality(outbox[p]),
     heldHead |-> 0, events |-> <<>>, poked |-> FALSE]

-----------------------------------------------------------------------------
(* syncMachine.ts *)

\* ask(): start a run, or mark the running one to go again.
Ask(r) ==
    CASE r.phase = "running" -> [r EXCEPT !.again = TRUE]
      [] r.phase \in {"idle", "waiting", "lockedout"} ->
            [r EXCEPT !.phase = "running", !.step = "session", !.again = FALSE, !.net = NoNet]
      [] OTHER -> r

\* settle(): outcome is "ok" | "lockout" | "retry" (offline or failed: both arm the timer).
Settle(r, outcome) ==
    LET ended == [r EXCEPT !.net = NoNet, !.step = "none", !.batches = <<>>, !.pushFailed = FALSE]
    IN CASE outcome = "ok" /\ r.again -> Ask([ended EXCEPT !.phase = "idle"])
         [] outcome = "ok" -> [ended EXCEPT !.phase = "idle"]
         [] outcome = "lockout" -> [ended EXCEPT !.phase = "lockedout"]
         [] OTHER -> IF Variant = "no-retry-timer"
                     THEN [ended EXCEPT !.phase = "idle"]
                     ELSE [ended EXCEPT !.phase = "waiting"]

\* The outbox in submit order (deviceLog.ts outbox(): sorted by `order`), cut into batches.
Ordered(p) == SelectSeq(OpsOf[p], LAMBDA op : op \in outbox[p])
RECURSIVE Chunks(_)
Chunks(s) == IF Len(s) = 0 THEN <<>>
             ELSE IF Len(s) <= BatchSize THEN <<s>>
             ELSE <<SubSeq(s, 1, BatchSize)>> \o Chunks(SubSeq(s, BatchSize + 1, Len(s)))

\* startPull(): reads the confirmed log for where to pull from.
StartPull(r, p, pushFailed) ==
    [r EXCEPT !.step = "pulling", !.pushFailed = pushFailed,
              !.net = Send("pull", <<>>, Len(confirmed[p]), FALSE)]

\* startPush(): reads the outbox once; later batches are what it read then.
StartPush(r, p) ==
    LET batches == Chunks(Ordered(p))
    IN IF batches = <<>> THEN StartPull(r, p, FALSE)
       ELSE [r EXCEPT !.step = "pushing", !.batches = batches,
                      !.net = Send("push", batches[1], 0, FALSE)]

-----------------------------------------------------------------------------
(* deviceLog.ts *)

\* confirm(): merge by seq, keep the gapless prefix (withoutGaps).
Merge(stored, pulled, from) ==
    LET at(n) == IF n > from /\ n <= from + Len(pulled) THEN pulled[n - from]
                 ELSE IF n <= Len(stored) THEN stored[n] ELSE "gap"
        top == IF from + Len(pulled) > Len(stored) THEN from + Len(pulled) ELSE Len(stored)
        covered == {k \in 0..top : \A n \in 1..k : at(n) # "gap"}
        k == CHOOSE k \in covered : \A j \in covered : j <= k
    IN IF Variant = "no-gap-cut" THEN [n \in 1..top |-> at(n)]
       ELSE [n \in 1..k |-> at(n)]

\* A write to this phone's storage: queue a `storage` event in every other open tab.
\* removed: the event's newValue is null. Back-to-back events of one kind merge.
Hear(tabs, t, removed) ==
    [u \in Tabs |->
        IF u # t /\ PhoneOf[u] = PhoneOf[t] /\ tabs[u].phase # "closed"
           /\ ~(Len(tabs[u].events) > 0 /\ tabs[u].events[Len(tabs[u].events)] = removed)
        THEN [tabs[u] EXCEPT !.events = Append(@, removed)]
        ELSE tabs[u]]

\* Realtime: an insert pokes every open tab of every member phone, the sender's too.
Poke(tabs) ==
    [u \in Tabs |->
        IF PhoneOf[u] \in members /\ tabs[u].phase # "closed"
        THEN [tabs[u] EXCEPT !.poked = TRUE] ELSE tabs[u]]

Reloaded(r, p, len, pending) == [r EXCEPT !.snapLen = len, !.snapPending = pending]

-----------------------------------------------------------------------------
Init ==
    /\ serverLog = <<>>
    /\ exists = FALSE
    /\ members = {}
    /\ outbox = [p \in Phones |-> IF p = Creator THEN {Created} ELSE {}]
    /\ confirmed = [p \in Phones |-> <<>>]
    /\ memberAs = [p \in Phones |-> FALSE]
    /\ submitted = [p \in Phones |-> IF p = Creator THEN 1 ELSE 0]
    /\ tab = [t \in Tabs |-> [Fresh(PhoneOf[t]) EXCEPT
                                !.snapPending = IF PhoneOf[t] = Creator THEN 1 ELSE 0]]
    /\ faults = 0
    /\ crashes = 0
    /\ friendWrote = 0

Open(t) == tab[t].phase # "closed"

\* GroupSync.submit(): appendPending, reload, sync-asked. One synchronous step.
Submit(t) ==
    LET p == PhoneOf[t]
        op == OpsOf[p][submitted[p] + 1]
    IN /\ Open(t)
       /\ submitted[p] < Len(OpsOf[p])
       /\ submitted' = [submitted EXCEPT ![p] = @ + 1]
       /\ outbox' = [outbox EXCEPT ![p] = @ \cup {op}]
       /\ LET heard == Hear(tab, t, FALSE)
          IN tab' = [heard EXCEPT ![t] = Ask(Reloaded(@, p, Len(confirmed[p]), Cardinality(outbox'[p])))]
       /\ UNCHANGED <<serverLog, exists, members, confirmed, memberAs, faults, crashes, friendWrote>>

\* stepSync 'session-replied': reads memberAs, then the outbox or confirmed log.
SessionReplied(t) ==
    LET r == tab[t]  p == PhoneOf[t]
    IN /\ r.phase = "running" /\ r.step = "session"
       /\ tab' = [tab EXCEPT ![t] =
             IF memberAs[p] THEN StartPush(r, p)
             ELSE [r EXCEPT !.step = "entering",
                            !.net = Send("enter", <<>>, 0, p = Creator /\ Created \in outbox[p])]]
       /\ UNCHANGED <<serverLog, exists, members, outbox, confirmed, memberAs, submitted, faults, crashes, friendWrote>>

(* ---- Server transactions ---- *)

\* create_group / join_group (fakeServer.ts createGroup, joinGroup).
ServerEnter(t) ==
    LET r == tab[t]  p == PhoneOf[t]
    IN /\ r.net.st = "sent" /\ r.net.kind = "enter"
       /\ IF r.net.publish
          THEN /\ exists' = TRUE
               /\ members' = members \cup {p}
               /\ IF exists \/ Variant = "create-then-insert" THEN UNCHANGED serverLog
                  ELSE serverLog' = <<Created>>
               /\ tab' = [tab EXCEPT ![t].net.st = "replied", ![t].net.ok = TRUE]
          ELSE /\ members' = IF exists THEN members \cup {p} ELSE members
               /\ tab' = [tab EXCEPT ![t].net.st = "replied", ![t].net.ok = exists]
               /\ UNCHANGED <<exists, serverLog>>
       /\ UNCHANGED <<outbox, confirmed, memberAs, submitted, faults, crashes, friendWrote>>

\* Only in the broken "create-then-insert" variant: the first op lands in a later transaction.
ServerLateFirstOp ==
    /\ Variant = "create-then-insert"
    /\ exists /\ Created \notin Range(serverLog)
    /\ serverLog' = Append(serverLog, Created)
    /\ UNCHANGED <<exists, members, outbox, confirmed, memberAs, submitted, tab, faults, crashes, friendWrote>>

\* A phone outside the model joins and appends one op (append_ops), poking every member tab.
FriendWrites ==
    /\ exists /\ friendWrote < Len(FriendOps)
    /\ serverLog' = Append(serverLog, FriendOps[friendWrote + 1])
    /\ friendWrote' = friendWrote + 1
    /\ tab' = Poke(tab)
    /\ UNCHANGED <<exists, members, outbox, confirmed, memberAs, submitted, faults, crashes>>

\* append_ops: under the group row lock, each op is rejected, already held, or gets head + 1.
RECURSIVE Append_(_, _)
Append_(log, batch) ==
    IF Len(batch) = 0 THEN log
    ELSE LET op == batch[1]
             held == op \in Range(log) /\ Variant # "no-idempotency"
         IN Append_(IF op \in Bad \/ held THEN log ELSE Append(log, op), Tail(batch))

ServerPush(t) ==
    LET r == tab[t]  p == PhoneOf[t]
        batch == r.net.batch
        after == Append_(serverLog, batch)
    IN /\ r.net.st = "sent" /\ r.net.kind = "push"
       /\ p \in members
       /\ serverLog' = after
       /\ LET replied == [tab EXCEPT ![t].net.st = "replied",
                                     ![t].net.rejected = {op \in Range(batch) : op \in Bad}]
          IN tab' = IF Len(after) > Len(serverLog) THEN Poke(replied) ELSE replied
       /\ UNCHANGED <<exists, members, outbox, confirmed, memberAs, submitted, faults, crashes, friendWrote>>

\* opsAfter, one page: ops with seq > after, and whether more remain.
ServerPull(t) ==
    LET r == tab[t]
        from == r.net.after
        n == IF Len(serverLog) - from > PageSize THEN PageSize
             ELSE IF Len(serverLog) > from THEN Len(serverLog) - from ELSE 0
    IN /\ r.net.st = "sent" /\ r.net.kind = "pull"
       /\ tab' = [tab EXCEPT ![t].net.st = "replied",
                             ![t].net.ops = SubSeq(serverLog, from + 1, from + n),
                             ![t].net.more = Len(serverLog) - from > PageSize]
       /\ UNCHANGED <<serverLog, exists, members, outbox, confirmed, memberAs, submitted, faults, crashes, friendWrote>>

(* ---- The network ---- *)

\* A request or its reply is lost: the tab sees `offline`. Or the server fails a push: `failed`.
Lose(t) ==
    /\ faults < MaxFaults
    /\ tab[t].net.st \in {"sent", "replied"}
    /\ tab' = [tab EXCEPT ![t].net.st = "lost"]
    /\ faults' = faults + 1
    /\ UNCHANGED <<serverLog, exists, members, outbox, confirmed, memberAs, submitted, crashes, friendWrote>>

FailPush(t) ==
    /\ faults < MaxFaults
    /\ tab[t].net.st = "sent" /\ tab[t].net.kind = "push"
    /\ tab' = [tab EXCEPT ![t].net.st = "failed"]
    /\ faults' = faults + 1
    /\ UNCHANGED <<serverLog, exists, members, outbox, confirmed, memberAs, submitted, crashes, friendWrote>>

(* ---- The tab hears back: stepSync, then the shell runs its effects ---- *)

\* stepSync 'entered' (step 'entering'), then the remember-member effect.
EnterReplied(t) ==
    LET r == tab[t]  p == PhoneOf[t]
    IN /\ r.net.kind = "enter" /\ r.net.st \in {"replied", "lost"}
       /\ IF r.net.st = "replied" /\ r.net.ok
          THEN /\ memberAs' = [memberAs EXCEPT ![p] = TRUE]
               /\ LET heard == Hear(tab, t, FALSE) IN tab' = [heard EXCEPT ![t] = StartPush(r, p)]
          ELSE /\ tab' = [tab EXCEPT ![t] = Settle(r, IF r.net.st = "lost" THEN "retry" ELSE "lockout")]
               /\ UNCHANGED memberAs
       /\ UNCHANGED <<serverLog, exists, members, outbox, confirmed, submitted, faults, crashes, friendWrote>>

\* stepSync 'pushed', then the drop effect (and its reload) and the next push or pull.
PushReplied(t) ==
    LET r == tab[t]  p == PhoneOf[t]
        lostOps == IF Variant = "drop-on-lost-reply" THEN Range(r.net.batch) ELSE {}
    IN /\ r.net.kind = "push" /\ r.net.st \in {"replied", "lost", "failed"}
       /\ CASE r.net.st = "replied" ->
                LET dropped == outbox[p] \ r.net.rejected
                    rest == Tail(r.batches)
                    next == IF rest = <<>> THEN StartPull(r, p, FALSE)
                            ELSE [r EXCEPT !.batches = rest, !.net = Send("push", rest[1], 0, FALSE)]
                    heard == IF r.net.rejected = {} THEN tab ELSE Hear(tab, t, TRUE)
                IN /\ outbox' = [outbox EXCEPT ![p] = dropped]
                   /\ tab' = [heard EXCEPT ![t] =
                                 IF r.net.rejected = {} THEN next
                                 ELSE Reloaded(next, p, Len(confirmed[p]), Cardinality(dropped))]
            [] r.net.st = "failed" ->
                /\ tab' = [tab EXCEPT ![t] = StartPull(r, p, TRUE)]
                /\ UNCHANGED outbox
            [] OTHER ->
                /\ outbox' = [outbox EXCEPT ![p] = @ \ lostOps]
                /\ tab' = [tab EXCEPT ![t] = Settle(r, "retry")]
       /\ UNCHANGED <<serverLog, exists, members, confirmed, memberAs, submitted, faults, crashes, friendWrote>>

\* stepSync 'pulled'. With ops, the confirm effect's read of the stored log is this step and
\* its write is ConfirmWrite: one synchronous step in a tab, but two tabs are two processes.
PullReplied(t) ==
    LET r == tab[t]  p == PhoneOf[t]
    IN /\ r.net.kind = "pull" /\ r.net.st \in {"replied", "lost"}
       /\ tab' = [tab EXCEPT ![t] =
             CASE r.net.st = "lost" -> Settle(r, "retry")
               [] Len(r.net.ops) = 0 -> Settle(r, IF r.pushFailed THEN "retry" ELSE "ok")
               [] OTHER -> [r EXCEPT !.net.st = "confirming", !.net.readBuf = confirmed[p]]]
       /\ UNCHANGED <<serverLog, exists, members, outbox, confirmed, memberAs, submitted, faults, crashes, friendWrote>>

\* deviceLog.confirm()'s write and outbox cleanup, the reload, then the next pull or settle().
ConfirmWrite(t) ==
    LET r == tab[t]  p == PhoneOf[t]
        merged == Merge(r.net.readBuf, r.net.ops, r.net.after)
        retired == {op \in Range(r.net.ops) : op \in Range(merged)}
        left == outbox[p] \ retired
        last == r.net.after + Len(r.net.ops)
        held == Len(merged)
        \* stepSync 'confirmed': stored short of this page's start. A write that kept nothing
        \* (the stored log is as long as before the page, `storedBefore`) is taken for a full store
        \* and ends the run; any other short write was cut by another tab and pulls again.
        short == held < r.net.after
        full == short /\ held = Len(r.net.readBuf)
        cut == short /\ ~full /\ Variant # "snapshot-shrink-check"
        kept == [r EXCEPT !.heldHead = IF held > @ THEN held ELSE @]
        next == CASE full -> Settle(kept, IF r.pushFailed THEN "retry" ELSE "ok")
                  [] cut -> [kept EXCEPT !.net = Send("pull", <<>>, held, FALSE)]
                  [] r.net.more -> [kept EXCEPT !.net = Send("pull", <<>>, last, FALSE)]
                  [] OTHER -> Settle(kept, IF r.pushFailed THEN "retry" ELSE "ok")
        wrote == Hear(tab, t, FALSE)
        heard == IF retired \cap outbox[p] = {} THEN wrote ELSE Hear(wrote, t, TRUE)
    IN /\ r.net.st = "confirming"
       /\ confirmed' = [confirmed EXCEPT ![p] = merged]
       /\ outbox' = [outbox EXCEPT ![p] = left]
       /\ tab' = [heard EXCEPT ![t] = Reloaded(next, p, Len(merged), Cardinality(left))]
       /\ UNCHANGED <<serverLog, exists, members, memberAs, submitted, faults, crashes, friendWrote>>

(* ---- What asks for a run ---- *)

RetryDue(t) ==
    /\ tab[t].phase = "waiting"
    /\ tab' = [tab EXCEPT ![t] = Ask(@)]
    /\ UNCHANGED <<serverLog, exists, members, outbox, confirmed, memberAs, submitted, faults, crashes, friendWrote>>

Poked(t) ==
    /\ Open(t) /\ tab[t].poked
    /\ tab' = [tab EXCEPT ![t] = IF Variant = "ignore-pokes" THEN [@ EXCEPT !.poked = FALSE]
                                 ELSE Ask([@ EXCEPT !.poked = FALSE])]
    /\ UNCHANGED <<serverLog, exists, members, outbox, confirmed, memberAs, submitted, faults, crashes, friendWrote>>

\* groupSync.ts onStorage: reload, then 'other-tab-wrote' with what the reload showed.
StorageEvent(t) ==
    LET r == tab[t]  p == PhoneOf[t]
        removed == r.events[1]
        shrank == Len(confirmed[p]) < r.snapLen
        grew == Cardinality(outbox[p]) > r.snapPending
        heard == [Reloaded(r, p, Len(confirmed[p]), Cardinality(outbox[p])) EXCEPT !.events = Tail(@)]
        \* The code: shorter than the longest log this tab has seen stored, or a queued change.
        \* "snapshot-shrink-check" is the code before e215b90: shorter than this tab's last reload.
        asks == CASE Variant = "snapshot-shrink-check" -> ~removed /\ (shrank \/ grew)
                  [] OTHER -> Len(confirmed[p]) < r.heldHead \/ grew
    IN /\ Open(t) /\ Len(r.events) > 0
       /\ tab' = [tab EXCEPT ![t] = IF asks THEN Ask(heard) ELSE heard]
       /\ UNCHANGED <<serverLog, exists, members, outbox, confirmed, memberAs, submitted, faults, crashes, friendWrote>>

\* A locked-out tab is shown again, or the phone comes back online (visibility, online).
UserReturns(t) ==
    /\ tab[t].phase = "lockedout"
    /\ tab' = [tab EXCEPT ![t] = Ask(@)]
    /\ UNCHANGED <<serverLog, exists, members, outbox, confirmed, memberAs, submitted, faults, crashes, friendWrote>>

\* The tab dies at any point. A request it sent and the server has not run is lost with it.
Crash(t) ==
    /\ crashes < MaxCrashes /\ Open(t)
    /\ tab' = [tab EXCEPT ![t] = [@ EXCEPT !.phase = "closed", !.net = NoNet, !.events = <<>>,
                                          !.poked = FALSE, !.step = "none", !.again = FALSE]]
    /\ crashes' = crashes + 1
    /\ UNCHANGED <<serverLog, exists, members, outbox, confirmed, memberAs, submitted, faults, friendWrote>>

\* groupSyncFor() makes a new engine: it reads the log and asks for a sync.
Reopen(t) ==
    /\ tab[t].phase = "closed"
    /\ tab' = [tab EXCEPT ![t] = Fresh(PhoneOf[t])]
    /\ UNCHANGED <<serverLog, exists, members, outbox, confirmed, memberAs, submitted, faults, crashes, friendWrote>>

-----------------------------------------------------------------------------
Engine(t) ==
    \/ SessionReplied(t) \/ ServerEnter(t) \/ ServerPush(t) \/ ServerPull(t)
    \/ EnterReplied(t) \/ PushReplied(t) \/ PullReplied(t) \/ ConfirmWrite(t)
    \/ RetryDue(t) \/ Poked(t) \/ StorageEvent(t) \/ UserReturns(t) \/ Reopen(t)

Next ==
    \/ \E t \in Tabs : Engine(t) \/ Submit(t) \/ Lose(t) \/ FailPush(t) \/ Crash(t)
    \/ ServerLateFirstOp \/ FriendWrites

Spec == Init /\ [][Next]_vars
    /\ \A t \in Tabs : WF_vars(Engine(t))
    /\ WF_vars(ServerLateFirstOp)

-----------------------------------------------------------------------------
(* Properties. Each one in plain words in formal/sync/README.md. *)

ServerOrder ==
    \* group.created is seq 1.
    Len(serverLog) > 0 => serverLog[1] = Created

ExactlyOnce ==
    \* No op is in the server log twice.
    \A i, j \in 1..Len(serverLog) : i # j => serverLog[i] # serverLog[j]

ConfirmedIsPrefix ==
    \* What a phone holds as confirmed is the server's log from seq 1, with no gaps.
    \A p \in Phones :
        Len(confirmed[p]) <= Len(serverLog)
        /\ \A n \in 1..Len(confirmed[p]) : confirmed[p][n] = serverLog[n]

NothingDropped ==
    \* A submitted op is on the server, or still queued on its phone, unless the server rejects it.
    \A p \in Phones : \A i \in 1..submitted[p] :
        LET op == OpsOf[p][i] IN op \in Range(serverLog) \/ op \in outbox[p] \/ op \in Bad

Delivered ==
    \* Every op the server can take reaches it.
    \A op \in AllOps \ Bad : op \in outbox[Owner(op)] ~> op \in Range(serverLog)

Converged ==
    \A p \in Phones : confirmed[p] = serverLog /\ outbox[p] = {}

Converges ==
    \* Once people stop editing, every phone ends up holding the server's log, outbox empty.
    <>[]Converged

\* Nothing is left for any engine or the server to do on its own: only a user, a fault or a
\* crash could move the system on.
Quiet == ~ENABLED (\E t \in Tabs : Engine(t)) /\ ~ENABLED ServerLateFirstOp

QuietMeansConverged ==
    \* The checkable core of Converges and Delivered: no run of the engines can come to rest with
    \* a phone missing part of the server's log or still holding an op the server could take.
    \* Converges itself is checked by liveness in Liveness.cfg, at smaller bounds.
    Quiet => Converged

=============================================================================
