import { useState } from 'react';
import type { ExpenseEntry, Member, MemberId, OpId } from '@features/group-ledger/domain/types';
import type { MyGroup } from '@features/group-ledger/hooks/useGroup';
import { TOO_BIG, entryFits, groupRate } from '@features/group-ledger/logic/expenseForm';
import { newEntryId, todayLocalDate } from '@features/group-ledger/logic/ids';
import { memberLabel } from '@features/group-ledger/logic/describe';
import { postReceipt } from '@features/group-ledger/logic/post';
import { showToast } from '@features/group-ledger/stores/toastStore';
import { actionBarButtonClass } from '@features/group-ledger/components/ui/classes';
import { Icon } from '@features/group-ledger/components/ui/IconButton';
import { PillSelect } from '@features/group-ledger/components/ui/PillSelect';
import {
  ReceiptEditor,
  discardReceiptDraft,
  useCurrencyStore,
  type SavedReceipt,
} from '@features/split-workspace';
import { navigate } from '@shared/routing';

interface GroupReceiptEditorProps {
  group: MyGroup;
  editing: { entry: ExpenseEntry; rev: OpId } | null;
}

export function GroupReceiptEditor({ group, editing }: GroupReceiptEditorProps) {
  const { ledger } = group;
  const holders = new Set(editing ? Object.keys(editing.entry.owed) : []);
  const members = ledger.members.filter((member) => !member.archived || holders.has(member.id));
  const draftKey = `group:${ledger.groupId}:receipt:${editing?.entry.id ?? 'new'}`;
  const back = () => navigate({ kind: 'group', groupId: ledger.groupId });
  const initial = editing?.entry.basis.kind === 'receipt' ? editing.entry.basis.receipt : undefined;

  return (
    <ReceiptEditor
      people={members.map(({ id, name }) => ({ id, name }))}
      initial={initial}
      draftKey={draftKey}
      onCancel={back}
      renderSave={(receipt) => (
        <SaveToGroup
          group={group}
          members={members}
          editing={editing}
          receipt={receipt}
          draftKey={draftKey}
        />
      )}
    />
  );
}

interface SaveToGroupProps {
  group: MyGroup;
  members: Member[];
  editing: { entry: ExpenseEntry; rev: OpId } | null;
  receipt: SavedReceipt;
  draftKey: string;
}

function SaveToGroup({ group, members, editing, receipt, draftKey }: SaveToGroupProps) {
  const { ledger, act } = group;
  const rates = useCurrencyStore((state) => state.exchangeRates);
  const [entryId] = useState(() => editing?.entry.id ?? newEntryId());
  const [payer, setPayer] = useState<MemberId>(() => editing?.entry.payment.payer ?? ledger.me);
  const entry = postReceipt(
    {
      id: entryId,
      title: receipt.name.trim() || 'Receipt',
      date: editing?.entry.date ?? todayLocalDate(),
      currency: receipt.currency,
      rate: groupRate(receipt.currency, ledger.currency, rates, receipt.exchangeRateOverride),
      payment: { payer, others: {} },
    },
    receipt,
    members,
  );

  const fits = entry !== null && entryFits(entry);

  const save = () => {
    if (entry === null || !fits) return;
    if (editing) act.editEntry(entry, editing.rev);
    else act.addExpense(entry);
    discardReceiptDraft(draftKey);
    navigate({ kind: 'group', groupId: ledger.groupId });
    showToast(`${editing ? 'Saved' : 'Added'} ${entry.title}`);
  };

  return (
    <>
      {entry !== null && !fits ? (
        <p className="min-w-0 flex-1 pl-3 text-sm text-white/70">{TOO_BIG}</p>
      ) : (
        <PillSelect
          label="Paid by"
          value={payer}
          options={members.map((member) => ({ value: member.id, label: member.name }))}
          onChange={setPayer}
          className="flex min-w-0 flex-1 flex-col justify-center rounded-2xl py-1 pl-3 hover:bg-white/10"
        >
          <span className="text-xs text-white/60">Paid by</span>
          <span className="flex items-center gap-0.5 truncate font-semibold">
            {memberLabel(ledger, payer)}
            <Icon name="expand_more" className="text-lg!" />
          </span>
        </PillSelect>
      )}
      <button
        type="button"
        data-testid="save-receipt-to-group"
        disabled={!fits}
        onClick={save}
        className={actionBarButtonClass(fits)}
      >
        Save
        <Icon name="check" className="text-lg!" />
      </button>
    </>
  );
}
