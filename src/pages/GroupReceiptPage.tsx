import { GroupGate, GroupReceiptScreen, asEntryId, asGroupId } from '@features/group-ledger';

export function GroupReceiptPage({ groupId, entryId }: { groupId: string; entryId?: string }) {
  return (
    <GroupGate groupId={asGroupId(groupId)}>
      {(group) => (
        <GroupReceiptScreen
          key={entryId ?? 'new'}
          group={group}
          entryId={entryId === undefined ? undefined : asEntryId(entryId)}
        />
      )}
    </GroupGate>
  );
}
