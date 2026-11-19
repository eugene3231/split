import { useEffect, useState } from 'react';
import type { EntryId, PostedEntry } from '@features/group-ledger/domain/types';
import type { ReadyGroup } from '@features/group-ledger/hooks/useGroup';
import { StateScreen } from '@features/group-ledger/components/ui/StateScreen';
import { buttonClass } from '@features/group-ledger/components/ui/classes';
import { Link, navigate } from '@shared/routing';
import { ExpenseForm } from './ExpenseForm';
import { TransferEditor } from './TransferEditor';

export function ExpenseScreen({ group, entryId }: { group: ReadyGroup; entryId?: EntryId }) {
  const live = entryId && group.ledger.entries.find((posted) => posted.entry.id === entryId);
  const [opened] = useState<PostedEntry | undefined>(() => live || undefined);
  const groupId = group.ledger.groupId;
  const isReceipt = opened?.entry.kind === 'expense' && opened.entry.basis.kind === 'receipt';

  useEffect(() => {
    if (isReceipt && entryId) navigate({ kind: 'receipt', groupId, entryId }, { replace: true });
  }, [isReceipt, groupId, entryId]);

  if (entryId === undefined) return <ExpenseForm group={group} />;
  if (!opened || !live) {
    return (
      <StateScreen
        icon="search_off"
        title="This expense is gone"
        action={
          <Link to={{ kind: 'group', groupId }} className={buttonClass('secondary')}>
            Back to {group.ledger.name}
          </Link>
        }
      >
        Someone deleted it, maybe on another phone. Its activity still shows it.
      </StateScreen>
    );
  }
  if (opened.entry.kind === 'transfer') {
    return <TransferEditor group={group} transfer={opened.entry} rev={opened.rev} />;
  }
  if (isReceipt) return null;
  return <ExpenseForm group={group} editing={{ entry: opened.entry, rev: opened.rev }} />;
}
