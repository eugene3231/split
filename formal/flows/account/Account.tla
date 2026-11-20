---- MODULE Account ----
\* "I keep my groups with my email" on one phone (sync/accountStore.ts, accountMachine.ts,
\* sync/carryNames.ts, backend/supabaseBackend.ts, components/home/AccountSheet.tsx).
VARIABLES step, mode, accountExists, accountHasName, name
vars == <<step, mode, accountExists, accountHasName, name>>

Init ==
  /\ step = "anonymous"
  /\ mode = "none"
  /\ accountExists \in BOOLEAN    \* TRUE: the email already has an account, from another phone
  /\ accountHasName \in BOOLEAN   \* that account already picked a name in the group
  /\ accountExists = FALSE => accountHasName = FALSE
  \* who this phone is in a group: "none" | "anon" | "released" | "account" | "with-account"
  \* | "orphan" (the name stayed with an anonymous user no phone is any more)
  /\ name = "none"

YouPickYourName ==
  /\ step \in {"anonymous", "linked"} /\ name \in {"none", "with-account"}
  /\ name' = IF step = "anonymous" THEN "anon" ELSE "account"
  /\ UNCHANGED <<step, mode, accountExists, accountHasName>>

YouEnterEmail ==
  /\ step = "anonymous"
  /\ step' = "sending"
  /\ UNCHANGED <<mode, accountExists, accountHasName, name>>

CodeNotSent ==
  /\ step = "sending"
  /\ step' = "anonymous"
  /\ UNCHANGED <<mode, accountExists, accountHasName, name>>

\* supabaseBackend.startEmailSignIn: updateUser for a new email, signInWithOtp for a known one.
CodeSent ==
  /\ step = "sending"
  /\ step' = "code-sent"
  /\ mode' = IF accountExists THEN "sign-in" ELSE "link"
  /\ UNCHANGED <<accountExists, accountHasName, name>>

YouCancel ==
  /\ step = "code-sent"
  /\ step' = "anonymous" /\ mode' = "none"
  /\ UNCHANGED <<accountExists, accountHasName, name>>

\* Sign-in with a name picked: carryNames.release gives the name up first, as the old user.
YouEnterTheCode ==
  /\ step = "code-sent"
  /\ IF mode = "sign-in" /\ name = "anon"
       THEN step' = "releasing" /\ name' = "released"
       ELSE step' = "checking" /\ UNCHANGED name
  /\ UNCHANGED <<mode, accountExists, accountHasName>>

ReleaseReachesServer ==
  /\ step = "releasing"
  /\ step' = "checking"
  /\ UNCHANGED <<mode, accountExists, accountHasName, name>>

\* The give-up did not get through: carryNames.restore claims the name back, the code is not checked.
ReleaseNoSignal ==
  /\ step = "releasing"
  /\ step' = "code-sent" /\ name' = "anon"
  /\ UNCHANGED <<mode, accountExists, accountHasName>>

\* Another tab shows "Who are you?" once the name is given up; picking there is still the old user.
YouPickInAnotherTab ==
  /\ step = "checking" /\ name = "released"
  /\ name' = "anon"
  /\ UNCHANGED <<step, mode, accountExists, accountHasName>>

\* A wrong code: carryNames.restore claims the given-up name back.
WrongCode ==
  /\ step = "checking"
  /\ step' = "code-sent"
  /\ name' = IF name = "released" THEN "anon" ELSE name
  /\ UNCHANGED <<mode, accountExists, accountHasName>>

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
  /\ UNCHANGED accountHasName

\* adoptAccountGroups, then carryNames.reclaim: the given-up name is claimed for the account,
\* unless the account already has a name in that group.
GroupsFound ==
  /\ step = "finding"
  /\ step' = "linked"
  /\ name' = IF name = "released"
               THEN IF accountHasName THEN "account-own" ELSE "account"
               ELSE name
  /\ UNCHANGED <<mode, accountExists, accountHasName>>

\* The phone becomes a new anonymous user and keeps its groups; the name stays with the account.
YouSignOut ==
  /\ step = "linked"
  /\ step' = "anonymous"
  /\ name' = IF name \in {"account", "account-own"} THEN "with-account" ELSE name
  /\ UNCHANGED <<mode, accountExists, accountHasName>>

Next ==
  YouPickYourName \/ YouEnterEmail \/ CodeNotSent \/ CodeSent \/ YouCancel \/ YouEnterTheCode
  \/ ReleaseReachesServer \/ ReleaseNoSignal \/ YouPickInAnotherTab \/ WrongCode
  \/ CodeAccepted \/ GroupsFound \/ YouSignOut

\* The name you picked in a group stays yours: never held by a user no phone is any more.
YourNameStaysYours == name # "orphan"
====
