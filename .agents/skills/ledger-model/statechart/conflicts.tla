---- MODULE conflicts ----
\* Two friends change one expense. Mirrors src/features/group-ledger/logic/entryLifecycle.ts
\* (stepEntry), the Restore button in components/activity/ActivityScreen.tsx and the delete
\* toast's Undo in components/expense/ExpenseForm.tsx. The server's seq is the one order, so
\* each write is one atomic step on `head`. A phone is up to date whenever it starts something;
\* what goes stale is the version on screen while an edit is open (`editing`), which is what
\* `base` carries in the code.
EXTENDS Naturals, FiniteSets

CONSTANT MaxRev

People == {"me", "friend"}

VARIABLES
  head,     \* [kind: "none"|"live"|"removed", rev: op that wrote it, content: version shown]
  rev,      \* last op id the server gave out
  editing,  \* person -> the rev on screen when their edit began, or 0 when not editing
  writes,   \* every op that saved or deleted the expense
  knowing,  \* ops that were overwritten by someone who had seen them
  offered,  \* activity rows that replaced an unseen write: [over: op it beat, content, row: op]
  outcome   \* "none" | "offered" | "restored" | "left": what the last conflict came to

vars == <<head, rev, editing, writes, knowing, offered, outcome>>

Init ==
  /\ head = [kind |-> "none", rev |-> 0, content |-> 0]
  /\ rev = 0
  /\ editing = [p \in People |-> 0]
  /\ writes = {}
  /\ knowing = {}
  /\ offered = {}
  /\ outcome = "none"

\* Whether a write based on `base` lands on a version its author never saw.
Unseen(base) == head.kind # "none" /\ base # head.rev

\* After an ordinary write: a new conflict is offered, an open one stays open, else settled.
After(unseen) == IF unseen \/ outcome = "offered" THEN "offered" ELSE "none"

\* One entry.put landing on the server: stepEntry's put branch.
Put(content, base) ==
  LET new == rev + 1
  IN /\ rev' = new
     /\ head' = [kind |-> "live", rev |-> new, content |-> content]
     /\ writes' = writes \cup {new}
     \* What the author really had on screen, worked out apart from the code's flag (Unseen).
     /\ knowing' = IF head.kind # "none" /\ base = head.rev THEN knowing \cup {head.rev} ELSE knowing
     /\ offered' = IF Unseen(base)
                     THEN offered \cup {[over |-> head.rev, content |-> head.content, row |-> new]}
                     ELSE offered

IAdd ==
  /\ head.kind = "none"
  /\ Put(1, 0)
  /\ UNCHANGED <<editing, outcome>>

StartEdit(p) ==
  /\ head.kind = "live"
  /\ editing[p] = 0
  /\ editing' = [editing EXCEPT ![p] = head.rev]
  /\ UNCHANGED <<head, rev, writes, knowing, offered, outcome>>

Save(p) ==
  /\ editing[p] # 0
  /\ Put(rev + 1, editing[p])
  /\ editing' = [editing EXCEPT ![p] = 0]
  /\ outcome' = After(Unseen(editing[p]))

\* stepEntry's remove branch, from a phone that has the current version on screen.
Delete(p) ==
  /\ head.kind = "live"
  /\ editing[p] = 0
  /\ rev' = rev + 1
  /\ head' = [head EXCEPT !.kind = "removed", !.rev = rev + 1]
  /\ writes' = writes \cup {rev + 1}
  /\ knowing' = knowing \cup {head.rev}
  /\ UNCHANGED <<editing, offered, outcome>>

\* The delete toast's Undo: a put based on the remove.
UndoDelete ==
  /\ head.kind = "removed"
  /\ Put(head.content, head.rev)
  /\ outcome' = After(FALSE)
  /\ UNCHANGED editing

\* Restore on a replaced row, as ActivityScreen sends it: base is the current rev, or the row's
\* own op when the expense is not in the list.
Restore ==
  /\ outcome = "offered"
  /\ \A p \in People : editing[p] = 0
  /\ \E o \in offered :
       LET base == IF head.kind = "live" THEN head.rev ELSE o.row
       IN /\ ~(head.kind = "live" /\ head.content = o.content)
          /\ Put(o.content, base)
          /\ outcome' = IF Unseen(base) THEN "offered" ELSE "restored"
  /\ UNCHANGED editing

\* Nobody taps Restore: once nobody is mid-edit, the row is left as it is.
Leave ==
  /\ outcome = "offered"
  /\ \A p \in People : editing[p] = 0
  /\ outcome' = "left"
  /\ UNCHANGED <<head, rev, editing, writes, knowing, offered>>

Next ==
  \/ IAdd
  \/ \E p \in People : StartEdit(p) \/ Save(p) \/ Delete(p)
  \/ UndoDelete
  \/ Restore
  \/ Leave

\* RULES the reader agrees to.

\* No change is lost silently: every save or delete anyone made is what everyone sees now, or
\* was overwritten by someone who had it on screen, or is in the activity list with a way back.
NoSilentLoss ==
  \A w \in writes :
    \/ w = head.rev
    \/ w \in knowing
    \/ \E o \in offered : o.over = w

\* Restore brings back the version that lost.
RestoreBringsItBack ==
  outcome = "restored" /\ head.kind = "live" => \E o \in offered : o.content = head.content

Bound == rev <= MaxRev /\ Cardinality(offered) <= 1
====
