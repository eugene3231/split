import { describe, expect, it } from 'vitest';
import type { Ledger, MemberId } from '@features/group-ledger/domain/types';
import type { ReadyGroup } from '@features/group-ledger/hooks/useGroup';
import type { SyncState, SyncStatus } from '@features/group-ledger/sync/groupSync';
import { gateScreen } from './gateScreen';

const sync = (state: SyncState): SyncStatus => ({
  state,
  pending: 0,
  lastSyncedAt: null,
  rejected: [],
  outboxStuck: false,
  unstored: 0,
});

function ready(me: MemberId | null): ReadyGroup {
  return { status: 'ready', ledger: { me } as Ledger, sync: sync('idle') } as ReadyGroup;
}

describe('gateScreen', () => {
  it('sends a group the phone does not hold back to its invite link', () => {
    expect(gateScreen({ status: 'missing' })).toEqual({ kind: 'not-on-phone' });
  });

  it('says the link stopped working when the code no longer lets this user in', () => {
    expect(gateScreen({ status: 'not-a-member', sync: sync('not-a-member') })).toEqual({
      kind: 'link-stopped',
    });
  });

  it('waits for a signal only while loading offline', () => {
    expect(gateScreen({ status: 'loading', sync: sync('offline') })).toEqual({
      kind: 'waiting-for-signal',
    });
    expect(gateScreen({ status: 'loading', sync: sync('syncing') })).toEqual({ kind: 'opening' });
    expect(gateScreen({ status: 'loading', sync: sync('error') })).toEqual({ kind: 'opening' });
  });

  it('asks who you are until this user has claimed a member', () => {
    const nobody = ready(null);
    const ana = ready('m-ana' as MemberId);

    expect(gateScreen(nobody)).toEqual({ kind: 'who-are-you', group: nobody });
    expect(gateScreen(ana)).toEqual({ kind: 'in-group', group: ana });
  });
});
