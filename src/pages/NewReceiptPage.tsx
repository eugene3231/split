import { GroupGate, GroupReceiptEditor, asGroupId } from '@features/group-ledger';

export function NewReceiptPage({ groupId }: { groupId: string }) {
  return (
    <GroupGate groupId={asGroupId(groupId)}>
      {(group) => <GroupReceiptEditor group={group} editing={null} />}
    </GroupGate>
  );
}
