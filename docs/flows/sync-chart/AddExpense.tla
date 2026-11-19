----------------------------- MODULE AddExpense -----------------------------
(* "I add an expense, maybe offline, and it reaches my friends."              *)
(* One expense on Ana's phone, her signal, her engine, and one friend.        *)
(* Engine phases follow src/features/group-ledger/sync/syncMachine.ts.        *)
EXTENDS Naturals

VARIABLES
    phone,     \* "none" | "pending" | "confirmed" | "dropped": what Ana's phone holds
    server,    \* "no" | "yes" | "refused"
    copies,    \* how many copies the server holds
    tooBig,    \* the expense is over the server's size limit
    signal,    \* "on" | "off"
    engine,    \* "idle" | "sending" | "retrying" | "stuck": idle, running, waiting (offline/error), waiting with the outbox stuck
    friend,    \* "unseen" | "seen": the friend's phone has pulled it
    replaced,  \* a friend's later edit of the same expense won
    shownRefused

vars == <<phone, server, copies, tooBig, signal, engine, friend, replaced, shownRefused>>

Init ==
    /\ phone = "none" /\ server = "no" /\ copies = 0 /\ tooBig = FALSE
    /\ signal \in {"on", "off"} /\ engine = "idle" /\ friend = "unseen"
    /\ replaced = FALSE /\ shownRefused = FALSE

YouAdd ==
    /\ phone = "none"
    /\ phone' = "pending" /\ tooBig' \in BOOLEAN /\ engine' = "sending"
    /\ UNCHANGED <<server, copies, signal, friend, replaced, shownRefused>>

SignalDrops ==
    /\ signal = "on" /\ signal' = "off"
    /\ UNCHANGED <<phone, server, copies, tooBig, engine, friend, replaced, shownRefused>>

SignalBack ==
    /\ signal = "off" /\ signal' = "on"
    /\ engine' = IF engine \in {"retrying", "stuck"} THEN "sending" ELSE engine
    /\ UNCHANGED <<phone, server, copies, tooBig, friend, replaced, shownRefused>>

NoConnection ==
    /\ engine = "sending" /\ signal = "off"
    /\ engine' = "retrying"
    /\ UNCHANGED <<phone, server, copies, tooBig, signal, friend, replaced, shownRefused>>

RetryTimer ==
    /\ engine \in {"retrying", "stuck"} /\ engine' = "sending"
    /\ UNCHANGED <<phone, server, copies, tooBig, signal, friend, replaced, shownRefused>>

\* append_ops stores it, but the reply never arrives: the phone keeps it and sends it again.
ReplyLost ==
    /\ engine = "sending" /\ signal = "on" /\ phone = "pending" /\ ~tooBig
    /\ server' = "yes" /\ copies' = IF server = "yes" THEN copies ELSE copies + 1
    /\ engine' = "retrying"
    /\ UNCHANGED <<phone, tooBig, signal, friend, replaced, shownRefused>>

\* Push accepted (stored, or already held), then the pull brings it back confirmed.
Synced ==
    /\ engine = "sending" /\ signal = "on" /\ phone = "pending" /\ ~tooBig
    /\ server' = "yes" /\ copies' = IF server = "yes" THEN copies ELSE copies + 1
    /\ phone' = "confirmed" /\ engine' = "idle"
    /\ UNCHANGED <<tooBig, signal, friend, replaced, shownRefused>>

Refused ==
    /\ engine = "sending" /\ signal = "on" /\ phone = "pending" /\ tooBig
    /\ server' = "refused" /\ phone' = "dropped" /\ shownRefused' = TRUE /\ engine' = "idle"
    /\ UNCHANGED <<copies, tooBig, signal, friend, replaced>>

\* The server fails the push: the run still pulls, and the change stays queued.
ServerFails ==
    /\ engine = "sending" /\ signal = "on" /\ phone = "pending"
    /\ engine' = "stuck"
    /\ UNCHANGED <<phone, server, copies, tooBig, signal, friend, replaced, shownRefused>>

FriendGetsIt ==
    /\ server = "yes" /\ friend = "unseen"
    /\ friend' = "seen"
    /\ UNCHANGED <<phone, server, copies, tooBig, signal, engine, replaced, shownRefused>>

\* The friend had edited the same expense offline; their op lands after Ana's and wins.
FriendsEditWins ==
    /\ phone = "confirmed" /\ ~replaced
    /\ replaced' = TRUE
    /\ UNCHANGED <<phone, server, copies, tooBig, signal, engine, friend, shownRefused>>

YouRestore ==
    /\ replaced /\ replaced' = FALSE
    /\ UNCHANGED <<phone, server, copies, tooBig, signal, engine, friend, shownRefused>>

Done ==
    /\ phone \in {"confirmed", "dropped"} /\ (friend = "seen" \/ phone = "dropped")
    /\ UNCHANGED vars

Next ==
    \/ YouAdd \/ SignalDrops \/ SignalBack \/ NoConnection \/ RetryTimer \/ ReplyLost
    \/ Synced \/ Refused \/ ServerFails \/ FriendGetsIt \/ FriendsEditWins \/ YouRestore \/ Done

Spec == Init /\ [][Next]_vars

NeverLost ==
    \* The expense is on the phone or on the server, unless the server refused it.
    phone # "none" => (phone \in {"pending", "confirmed"} \/ server = "yes" \/ server = "refused")
OnceOnServer == copies <= 1
RefusalShown == phone = "dropped" => shownRefused
FriendsSeeOnlyWhatServerHas == friend = "seen" => server = "yes"
SyncedMeansOnServer == phone = "confirmed" => server = "yes"
=============================================================================
