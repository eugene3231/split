import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SyncStatus } from '@features/group-ledger/sync/groupSync';
import { SyncBadge } from './SyncBadge';

const synced: SyncStatus = {
  state: 'offline',
  pending: 1,
  lastSyncedAt: null,
  rejected: [],
  outboxStuck: false,
  unstored: 0,
};

describe('SyncBadge', () => {
  it('warns ahead of everything else when a change could not be kept on the phone', () => {
    render(<SyncBadge sync={{ ...synced, unstored: 1 }} />);

    expect(screen.getByRole('status')).toHaveTextContent(/storage is full/i);
  });

  it('says a change is kept on the phone when it was stored', () => {
    render(<SyncBadge sync={synced} />);

    expect(screen.getByRole('status')).toHaveTextContent(/saved on this phone/i);
  });
});
