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
 * here may still be on its way, so it is only called gone once this tab has caught up. Once open,
 * the editor stays even if someone deletes the entry, so what is typed here can still be saved.
 */
export function EntryScreen({ group, entryId }: { group: MyGroup; entryId: EntryId }) {
  const { ledger, sync } = group;
  const live = ledger.entries.find((posted) => posted.entry.id === entryId);
  const [opened, setOpened] = useState(live);
  if (live && opened?.entry.id !== entryId) setOpened(live);
  const shown = opened?.entry.id === entryId ? opened : live;

  if (shown) return <EntryEditor key={entryId} group={group} opened={shown} />;
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

/** Takes the entry as it was when it opened, so an edit made elsewhere meanwhile never throws away what is typed here. */
function EntryEditor({ group, opened }: { group: MyGroup; opened: PostedEntry }) {
  const { entry, written, rev } = opened;
  if (entry.kind === 'transfer') return <TransferEditor group={group} transfer={entry} rev={rev} />;
  const editing = { entry, written: written.kind === 'expense' ? written : entry, rev };
  if (entry.basis.kind === 'receipt') return <GroupReceiptEditor group={group} editing={editing} />;
  return <ExpenseForm group={group} editing={editing} />;
}
