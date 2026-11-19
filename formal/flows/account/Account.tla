---- MODULE Account ----
\* "I keep my groups with my email" on one phone (sync/accountStore.ts, accountMachine.ts,
\* backend/supabaseBackend.ts, components/home/AccountSheet.tsx).
VARIABLES step, mode, accountExists, name
vars == <<step, mode, accountExists, name>>

Init ==
  /\ step = "anonymous"
  /\ mode = "none"
  /\ accountExists \in BOOLEAN    \* TRUE: the email already has an account, from another phone
  /\ name = "none"                \* who this phone is in a group: "none" | "anon" | "account" | "with-account" | "orphan"

YouPickYourName ==
  /\ step \in {"anonymous", "linked"} /\ name \in {"none", "with-account"}
  /\ name' = IF step = "anonymous" THEN "anon" ELSE "account"
  /\ UNCHANGED <<step, mode, accountExists>>

YouEnterEmail ==
  /\ step = "anonymous"
  /\ step' = "sending"
  /\ UNCHANGED <<mode, accountExists, name>>

CodeNotSent ==
  /\ step = "sending"
  /\ step' = "anonymous"
  /\ UNCHANGED <<mode, accountExists, name>>

\* supabaseBackend.startEmailSignIn: updateUser for a new email, signInWithOtp for a known one.
CodeSent ==
  /\ step = "sending"
  /\ step' = "code-sent"
  /\ mode' = IF accountExists THEN "sign-in" ELSE "link"
  /\ UNCHANGED <<accountExists, name>>

YouCancel ==
  /\ step = "code-sent"
  /\ step' = "anonymous" /\ mode' = "none"
  /\ UNCHANGED <<accountExists, name>>

YouEnterTheCode ==
  /\ step = "code-sent"
  /\ step' = "checking"
  /\ UNCHANGED <<mode, accountExists, name>>

WrongCode ==
  /\ step = "checking"
  /\ step' = "code-sent"
  /\ UNCHANGED <<mode, accountExists, name>>

\* Link keeps the user, so a name picked stays. Sign-in switches to the account's user, so a
\* name picked as this phone's anonymous user stays with that user, which no phone is any more.
CodeAccepted ==
  /\ step = "checking"
  /\ IF mode = "link"
       THEN /\ step' = "linked" /\ accountExists' = TRUE
            /\ name' = IF name = "anon" THEN "account" ELSE name
       ELSE /\ step' = "finding" /\ UNCHANGED accountExists
            /\ name' = CASE name = "anon" -> "orphan"
                         [] name = "with-account" -> "account"
                         [] OTHER -> name
  /\ mode' = "none"

\* adoptAccountGroups: the account's groups are added, this phone's stay.
GroupsFound ==
  /\ step = "finding"
  /\ step' = "linked"
  /\ UNCHANGED <<mode, accountExists, name>>

\* The phone becomes a new anonymous user and keeps its groups; the name stays with the account.
YouSignOut ==
  /\ step = "linked"
  /\ step' = "anonymous"
  /\ name' = IF name = "account" THEN "with-account" ELSE name
  /\ UNCHANGED <<mode, accountExists>>

Next ==
  YouPickYourName \/ YouEnterEmail \/ CodeNotSent \/ CodeSent \/ YouCancel \/ YouEnterTheCode
  \/ WrongCode \/ CodeAccepted \/ GroupsFound \/ YouSignOut

\* The name you picked in a group stays yours: never held by a user no phone is any more.
YourNameStaysYours == name # "orphan"
====
