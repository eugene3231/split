import type { GroupId, MemberId, UserId } from '@features/group-ledger/domain/types';
import { foldLedger } from '@features/group-ledger/logic/fold';
import { groupSyncFor } from '@features/group-ledger/sync/groupSync';
import { useJoinedGroupsStore } from '@features/group-ledger/sync/joinedGroupsStore';

/** A name this phone held in a group before it signed in to another account. */
export interface HeldName {
  groupId: GroupId;
  memberId: MemberId;
}

/**
 * Carries the names this phone picked across a sign-in to an account the email already has.
 * Only the user holding a name can give it up, so the phone gives up each name while it is still
 * the old user, and claims it again once it is the account. The first to claim keeps a member,
 * so without this the old user would keep the name and the account would be asked who it is.
 */
export interface NameCarrier {
  /**
   * Gives up every name `self` holds and waits for the server to take that. Null when a give-up
   * did not get through: the names are claimed back and the sign-in should not go ahead.
   */
  release(self: UserId): Promise<HeldName[] | null>;
  /** Claims the names back as the same user, after the code was refused. */
  restore(held: readonly HeldName[]): void;
  /**
   * Claims each name as the account, where the account holds no name in that group yet and nobody
   * else took the name meanwhile. Run once the account's groups are synced, so its own names count.
   */
  reclaim(held: readonly HeldName[], account: UserId): void;
}

const claim = (groupId: GroupId, memberId: MemberId | null) =>
  groupSyncFor(groupId)?.submit({ kind: 'member.claimed', memberId });

const ledgerFor = (groupId: GroupId, self: UserId) => {
  const engine = groupSyncFor(groupId);
  return engine ? foldLedger(engine.getSnapshot().log, self) : null;
};

export const carryNames: NameCarrier = {
  async release(self) {
    const held: HeldName[] = [];
    for (const { groupId } of useJoinedGroupsStore.getState().groups) {
      const memberId = ledgerFor(groupId, self)?.me ?? null;
      if (memberId === null) continue;
      held.push({ groupId, memberId });
      claim(groupId, null);
    }
    await Promise.all(held.map(({ groupId }) => groupSyncFor(groupId)?.syncNow()));
    const sent = held.every(
      ({ groupId }) => groupSyncFor(groupId)?.getSnapshot().sync.pending === 0,
    );
    if (sent) return held;
    carryNames.restore(held);
    return null;
  },

  restore(held) {
    for (const { groupId, memberId } of held) claim(groupId, memberId);
  },

  reclaim(held, account) {
    for (const { groupId, memberId } of held) {
      const ledger = ledgerFor(groupId, account);
      if (ledger === null || ledger.me !== null || ledger.claimed.has(memberId)) continue;
      claim(groupId, memberId);
    }
  },
};
