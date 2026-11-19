import { useEffect, useSyncExternalStore } from 'react';
import type {
  Cents,
  GroupId,
  Ledger,
  MemberId,
  Transfer,
} from '@features/group-ledger/domain/types';
import { computeBalances } from '@features/group-ledger/logic/balances';
import { foldLedger } from '@features/group-ledger/logic/fold';
import { settleUp } from '@features/group-ledger/logic/settleUp';
import { useAccountStore } from '@features/group-ledger/sync/accountStore';
import { groupActions, type GroupActions } from '@features/group-ledger/sync/groupActions';
import {
  groupSyncFor,
  type GroupSnapshot,
  type GroupSync,
  type SyncStatus,
} from '@features/group-ledger/sync/groupSync';
import { useJoinedGroupsStore } from '@features/group-ledger/sync/joinedGroupsStore';

export interface ReadyGroup {
  status: 'ready';
  ledger: Ledger;
  /** Group cents per member: positive is owed money. */
  balances: Record<MemberId, Cents>;
  /** The fewest payments that settle everyone. */
  transfers: Transfer[];
  sync: SyncStatus;
  act: GroupActions;
}

export type GroupView =
  /** This phone does not hold the group. */
  | { status: 'missing' }
  /** Held, but the op that creates it has not arrived yet. */
  | { status: 'loading'; sync: SyncStatus }
  /** Held, never loaded, and the invite code no longer opens it. */
  | { status: 'not-a-member'; sync: SyncStatus }
  | ReadyGroup;

const noSubscription = () => () => {};
const noSnapshot = () => null;

/** A group this phone holds, folded from its log and kept current as the log changes. */
export function useGroup(groupId: GroupId): GroupView {
  const held = useJoinedGroupsStore((state) =>
    state.groups.find((group) => group.groupId === groupId),
  );
  const self = useAccountStore((state) => state.session?.userId ?? null);
  const engine: GroupSync | null = held ? groupSyncFor(groupId) : null;
  const snapshot: GroupSnapshot | null = useSyncExternalStore(
    engine?.subscribe ?? noSubscription,
    engine?.getSnapshot ?? noSnapshot,
  );
  const ledger = snapshot && foldLedger(snapshot.log, self);
  const syncState = snapshot?.sync.state;

  // A phone that was offline when it first opened Split learns who it is from the first sync.
  useEffect(() => {
    if (self === null && syncState !== undefined) void useAccountStore.getState().load();
  }, [self, syncState]);

  // Restored groups arrive with no name, and a rename on another phone changes it.
  const name = ledger?.name;
  useEffect(() => {
    if (name !== undefined && held && held.name !== name) {
      useJoinedGroupsStore.getState().setName(groupId, name);
    }
  }, [groupId, held, name]);

  if (!engine || !snapshot) return { status: 'missing' };
  if (ledger === null) {
    return snapshot.sync.state === 'not-a-member'
      ? { status: 'not-a-member', sync: snapshot.sync }
      : { status: 'loading', sync: snapshot.sync };
  }
  const balances = computeBalances(ledger);
  return {
    status: 'ready',
    ledger,
    balances,
    transfers: settleUp(balances),
    sync: snapshot.sync,
    act: groupActions(engine.submit),
  };
}
