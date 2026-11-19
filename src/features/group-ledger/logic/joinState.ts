import type { GroupId } from '@features/group-ledger/domain/types';
import type { BackendFailure } from '@features/group-ledger/backend/port';

/** Where opening an invite link has got to. */
export type JoinState =
  | { step: 'joining' }
  | { step: 'joined'; groupId: GroupId }
  /** No group opens with this code: mistyped, or made offline and not on the server yet. */
  | { step: 'bad-link' }
  | { step: 'offline'; retry: () => void }
  | { step: 'failed'; message: string; retry: () => void };

/**
 * A group this phone holds opens at once, with or without a signal. Otherwise the last answer to
 * joining decides: none yet is still joining.
 */
export function joinStateOf(
  held: { groupId: GroupId } | undefined,
  failure: BackendFailure | null,
  retry: () => void,
): JoinState {
  if (held) return { step: 'joined', groupId: held.groupId };
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
