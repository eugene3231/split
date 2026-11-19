------------------------------- MODULE Liveness --------------------------------
(* Delivered and Converges as temporal properties, at bounds small enough for TLC's        *)
(* liveness checker: one tab each for Ana and Ben, one fault, one crash. The larger models  *)
(* check the same promise as the invariant QuietMeansConverged.                             *)
EXTENDS SyncEngine

LVPhones == {"ana", "ben"}
LVTabs == {"ana1", "ben1"}
LVPhoneOf == [t \in LVTabs |-> IF t = "ana1" THEN "ana" ELSE "ben"]
LVOpsOf == [p \in LVPhones |-> IF p = "ana" THEN <<"created", "a1">> ELSE <<"b1">>]
LVFriendOps == <<>>
=============================================================================
