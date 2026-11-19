import { GroupGate, GroupScreen, asGroupId } from '@features/group-ledger';

export function GroupPage({ groupId }: { groupId: string }) {
  return (
    <GroupGate groupId={asGroupId(groupId)}>{(group) => <GroupScreen group={group} />}</GroupGate>
  );
}
