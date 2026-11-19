import { ExpenseForm, GroupGate, asGroupId } from '@features/group-ledger';

export function NewExpensePage({ groupId }: { groupId: string }) {
  return (
    <GroupGate groupId={asGroupId(groupId)}>{(group) => <ExpenseForm group={group} />}</GroupGate>
  );
}
