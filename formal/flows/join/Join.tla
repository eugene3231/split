---- MODULE Join ----
\* A friend opens my invite link on a new phone and joins (hooks/useJoinGroup.ts,
\* components/join/JoinScreen.tsx, components/group/gateScreen.ts, WhoAreYou.tsx).
VARIABLES screen, onServer, friendHasAna, myName
vars == <<screen, onServer, friendHasAna, myName>>

Init ==
  /\ screen = "link"
  /\ onServer \in BOOLEAN          \* FALSE: the maker made the group offline and is still offline
  /\ friendHasAna = FALSE
  /\ myName = "none"               \* "none" | "ana-sending" | "ana" | "new"

YouOpenTheLink ==
  /\ screen \in {"link", "home"}
  /\ screen' = "joining"
  /\ UNCHANGED <<onServer, friendHasAna, myName>>

JoinNoSignal ==
  /\ screen = "joining"
  /\ screen' = "needs-signal"
  /\ UNCHANGED <<onServer, friendHasAna, myName>>

JoinNotFound ==
  /\ screen = "joining" /\ ~onServer
  /\ screen' = "bad-link"
  /\ UNCHANGED <<onServer, friendHasAna, myName>>

JoinServerFails ==
  /\ screen = "joining"
  /\ screen' = "couldnt-join"
  /\ UNCHANGED <<onServer, friendHasAna, myName>>

Joined ==
  /\ screen = "joining" /\ onServer
  /\ screen' = "opening"
  /\ UNCHANGED <<onServer, friendHasAna, myName>>

YouTryAgain ==
  /\ screen \in {"needs-signal", "couldnt-join"}
  /\ screen' = "joining"
  /\ UNCHANGED <<onServer, friendHasAna, myName>>

YouGoHome ==
  /\ screen \in {"bad-link", "needs-signal", "couldnt-join"}
  /\ screen' = "home"
  /\ UNCHANGED <<onServer, friendHasAna, myName>>

MakerComesOnline ==
  /\ ~onServer
  /\ onServer' = TRUE
  /\ UNCHANGED <<screen, friendHasAna, myName>>

SignalDrops ==
  /\ screen = "opening"
  /\ screen' = "waiting-signal"
  /\ UNCHANGED <<onServer, friendHasAna, myName>>

SignalComesBack ==
  /\ screen = "waiting-signal"
  /\ screen' = "opening"
  /\ UNCHANGED <<onServer, friendHasAna, myName>>

GroupArrives ==
  /\ screen = "opening"
  /\ screen' = "who-are-you"
  /\ UNCHANGED <<onServer, friendHasAna, myName>>

\* Another friend taps Ana on their phone, and the server takes theirs first.
FriendPicksAna ==
  /\ ~friendHasAna
  /\ myName \in {"none", "ana-sending"}
  /\ friendHasAna' = TRUE
  /\ UNCHANGED <<screen, onServer, myName>>

\* Ana shows as free on this phone (WhoAreYou disables a taken name).
YouPickAna ==
  /\ screen = "who-are-you" /\ ~friendHasAna
  /\ screen' = "in-group"
  /\ myName' = "ana-sending"
  /\ UNCHANGED <<onServer, friendHasAna>>

\* The claim reaches the server. First claimer keeps a member (logic/fold.ts).
ClaimArrives ==
  /\ myName = "ana-sending"
  /\ IF friendHasAna
       THEN screen' = "who-are-you" /\ myName' = "none"
       ELSE UNCHANGED screen /\ myName' = "ana"
  /\ UNCHANGED <<onServer, friendHasAna>>

YouAddYourName ==
  /\ screen = "who-are-you"
  /\ screen' = "in-group"
  /\ myName' = "new"
  /\ UNCHANGED <<onServer, friendHasAna>>

Done ==
  /\ screen \in {"home", "in-group"} /\ myName # "ana-sending"
  /\ UNCHANGED vars

Next ==
  YouOpenTheLink \/ JoinNoSignal \/ JoinNotFound \/ JoinServerFails \/ Joined \/ YouTryAgain
  \/ YouGoHome \/ MakerComesOnline \/ SignalDrops \/ SignalComesBack \/ GroupArrives
  \/ FriendPicksAna \/ YouPickAna \/ ClaimArrives \/ YouAddYourName \/ Done

\* You are never in the group as a name the server gave a friend first.
NeverSomeoneElsesName == ~(myName = "ana" /\ friendHasAna)
====
