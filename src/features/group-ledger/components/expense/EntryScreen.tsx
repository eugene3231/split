import { useState } from 'react';
import type { EntryId, PostedEntry } from '@features/group-ledger/domain/types';
import type { MyGroup } from '@features/group-ledger/hooks/useGroup';
import { StateScreen } from '@features/group-ledger/components/ui/StateScreen';
import { buttonClass } from '@features/group-ledger/components/ui/classes';
import { GroupReceiptEditor } from '@features/group-ledger/components/receipt/GroupReceiptEditor';
import { Link } from '@shared/routing';
import { ExpenseForm } from './ExpenseForm';
import { TransferEditor } from './TransferEditor';

/**
 * Opens an entry in the editor that fits it, once the entry is on this phone. An entry missing
 * here may still be on its way, so it is only called gone once this tab has caught up.
 */
export function EntryScreen({ group, entryId }: { group: MyGroup; entryId: EntryId }) {
  const { ledger, sync } = group;
  const live = ledger.entries.find((posted) => posted.entry.id === entryId);

  if (live) return <EntryEditor key={entryId} group={group} opened={live} />;
  if (sync.lastSyncedAt === null) {
    return sync.state === 'offline' ? (
      <StateScreen icon="cloud_off" title="Waiting for a signal">
        This entry isn't on this phone yet. It opens once this phone is online.
      </StateScreen>
    ) : (
      <StateScreen icon="progress_activity" title="Finding this entry…" busy />
    );
  }
  return (
    <StateScreen
      icon="search_off"
      title="This entry is gone"
      action={
        <Link to={{ kind: 'group', groupId: ledger.groupId }} className={buttonClass('secondary')}>
          Back to {ledger.name}
        </Link>
      }
    >
      Someone deleted it, maybe on another phone. Its activity still shows it.
    </StateScreen>
  );
}

/**
 * The entry is read once, when it first opens, so an edit someone else makes meanwhile never
 * throws away what is being typed here.
 */
function EntryEditor({ group, opened }: { group: MyGroup; opened: PostedEntry }) {
  const [{ entry, rev }] = useState(opened);
  if (entry.kind === 'transfer') return <TransferEditor group={group} transfer={entry} rev={rev} />;
  if (entry.basis.kind === 'receipt') {
    return <GroupReceiptEditor group={group} editing={{ entry, rev }} />;
  }
  return <ExpenseForm group={group} editing={{ entry, rev }} />;
}
