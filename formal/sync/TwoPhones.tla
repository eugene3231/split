------------------------------- MODULE TwoPhones -------------------------------
(* Ana made the group; Ben opened the invite link, maybe before Ana's phone published it.   *)
(* One tab each. Ben's second op is too large, so the server rejects it for good.          *)
EXTENDS SyncEngine

TPPhones == {"ana", "ben"}
TPTabs == {"ana1", "ben1"}
TPPhoneOf == [t \in TPTabs |-> IF t = "ana1" THEN "ana" ELSE "ben"]
TPOpsOf == [p \in TPPhones |-> IF p = "ana" THEN <<"created", "a1">> ELSE <<"b1", "bTooBig">>]
TPFriendOps == <<>>
=============================================================================
