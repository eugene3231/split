import { EntryScreen, GroupGate, asEntryId, asGroupId } from '@features/group-ledger';

export function EntryPage({ groupId, entryId }: { groupId: string; entryId: string }) {
  return (
    <GroupGate groupId={asGroupId(groupId)}>
      {(group) => <EntryScreen group={group} entryId={asEntryId(entryId)} />}
    </GroupGate>
  );
}
