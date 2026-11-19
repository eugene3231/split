import {
  isMine,
  type GroupView,
  type MyGroup,
  type ReadyGroup,
} from '@features/group-ledger/hooks/useGroup';

/** What stands in front of every group screen, worked out from the group as this tab sees it. */
export type GateScreen =
  /** The phone does not hold the group: only its invite link brings it here. */
  | { kind: 'not-on-phone' }
  /** Held, never opened, and its invite code no longer lets this user in. */
  | { kind: 'link-stopped' }
  /** Held, never opened, and no signal to fetch it. */
  | { kind: 'waiting-for-signal' }
  | { kind: 'opening' }
  /** Open, but this user has not said which member they are. */
  | { kind: 'who-are-you'; group: ReadyGroup }
  | { kind: 'in-group'; group: MyGroup };

export function gateScreen(group: GroupView): GateScreen {
  switch (group.status) {
    case 'missing':
      return { kind: 'not-on-phone' };
    case 'not-a-member':
      return { kind: 'link-stopped' };
    case 'loading':
      return group.sync.state === 'offline' ? { kind: 'waiting-for-signal' } : { kind: 'opening' };
    case 'ready':
      return isMine(group) ? { kind: 'in-group', group } : { kind: 'who-are-you', group };
  }
}
