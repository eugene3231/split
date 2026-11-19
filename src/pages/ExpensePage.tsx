import { ExpenseScreen, GroupGate, asEntryId, asGroupId } from '@features/group-ledger';

export function ExpensePage({ groupId, entryId }: { groupId: string; entryId?: string }) {
  return (
    <GroupGate groupId={asGroupId(groupId)}>
      {(group) => (
        <ExpenseScreen
          key={entryId ?? 'new'}
          group={group}
          entryId={entryId === undefined ? undefined : asEntryId(entryId)}
        />
      )}
    </GroupGate>
  );
}
