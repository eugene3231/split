import { useEffect, useState } from 'react';
import type { GroupId } from '@features/group-ledger/domain/types';
import type { BackendFailure } from '@features/group-ledger/backend/port';
import { asInviteCode } from '@features/group-ledger/logic/ids';
import { groupSyncFor, ledgerBackend } from '@features/group-ledger/sync/groupSync';
import { useJoinedGroupsStore } from '@features/group-ledger/sync/joinedGroupsStore';

export type JoinState =
  | { step: 'joining' }
  | { step: 'joined'; groupId: GroupId }
  /** No group opens with this code: mistyped, or made offline and not on the server yet. */
  | { step: 'bad-link' }
  | { step: 'offline'; retry: () => void }
  | { step: 'failed'; message: string; retry: () => void };

interface FailedJoin {
  code: string;
  failure: BackendFailure;
}

/**
 * Joins the group an invite code opens and adds it to this phone. A group the phone already holds
 * opens at once, offline too. Who you are in the group is asked once it has loaded.
 */
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

  if (held) return { step: 'joined', groupId: held.groupId };
  const failure = failed?.code === inviteCode ? failed.failure : null;
  const retry = () => {
    setFailed(null);
    setTries((count) => count + 1);
  };
  switch (failure?.kind) {
    case undefined:
      return { step: 'joining' };
    case 'invite-not-found':
    case 'not-a-member':
      return { step: 'bad-link' };
    case 'offline':
      return { step: 'offline', retry };
    case 'failed':
      return { step: 'failed', message: failure.message, retry };
  }
}
