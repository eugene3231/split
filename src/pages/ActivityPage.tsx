import { ActivityScreen, GroupGate, asGroupId } from '@features/group-ledger';

export function ActivityPage({ groupId }: { groupId: string }) {
  return (
    <GroupGate groupId={asGroupId(groupId)}>
      {(group) => <ActivityScreen group={group} />}
    </GroupGate>
  );
}
