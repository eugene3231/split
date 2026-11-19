import { GroupGate, SettleScreen, asGroupId } from '@features/group-ledger';

export function SettlePage({ groupId }: { groupId: string }) {
  return (
    <GroupGate groupId={asGroupId(groupId)}>{(group) => <SettleScreen group={group} />}</GroupGate>
  );
}
