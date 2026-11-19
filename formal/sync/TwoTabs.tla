-------------------------------- MODULE TwoTabs --------------------------------
(* Ana made the group and has it open in two tabs of one phone, sharing its localStorage.   *)
(* A friend's phone, outside the model, writes one op whenever it likes once the group exists. *)
EXTENDS SyncEngine

TTPhones == {"ana"}
TTTabs == {"ana1", "ana2"}
TTPhoneOf == [t \in TTTabs |-> "ana"]
TTOpsOf == [p \in TTPhones |-> <<"created", "a1">>]
TTFriendOps == <<"f1">>
=============================================================================
