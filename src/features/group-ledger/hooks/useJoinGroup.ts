import { useEffect, useState } from 'react';
import type { BackendFailure } from '@features/group-ledger/backend/port';
import { asInviteCode } from '@features/group-ledger/logic/ids';
import { joinStateOf, type JoinState } from '@features/group-ledger/logic/joinState';
import { groupSyncFor, ledgerBackend } from '@features/group-ledger/sync/groupSync';
import { useJoinedGroupsStore } from '@features/group-ledger/sync/joinedGroupsStore';

interface FailedJoin {
  code: string;
  failure: BackendFailure;
}

export function useJoinGroup(inviteCode: string): JoinState {
  const held = useJoinedGroupsStore((state) =>
    state.groups.find((group) => group.inviteCode === inviteCode),
  );
  const [tries, setTries] = useState(0);
  const [failed, setFailed] = useState<FailedJoin | null>(null);

  useEffect(() => {
    if (held) return;
    let current = true;
    void (async () => {
      const joined = await ledgerBackend().joinGroup(asInviteCode(inviteCode));
      if (!current) return;
      if (!joined.ok) {
        setFailed({ code: inviteCode, failure: joined.failure });
        return;
      }
      useJoinedGroupsStore.getState().add({ ...joined.value, createdHere: false, name: '' });
      void groupSyncFor(joined.value.groupId)?.syncNow();
    })();
    return () => {
      current = false;
    };
  }, [held, inviteCode, tries]);

  const failure = failed?.code === inviteCode ? failed.failure : null;
  return joinStateOf(held, failure, () => {
    setFailed(null);
    setTries((count) => count + 1);
  });
}
