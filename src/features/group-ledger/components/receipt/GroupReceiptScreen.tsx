import { useEffect, useState } from 'react';
import type {
  EntryId,
  ExpenseEntry,
  Member,
  MemberId,
  OpId,
} from '@features/group-ledger/domain/types';
import type { ReadyGroup } from '@features/group-ledger/hooks/useGroup';
import { TOO_BIG, entryFits, groupRate } from '@features/group-ledger/logic/expenseForm';
import { newEntryId, todayLocalDate } from '@features/group-ledger/logic/ids';
import { postReceipt } from '@features/group-ledger/logic/post';
import { showToast } from '@features/group-ledger/stores/toastStore';
import { actionBarButtonClass } from '@features/group-ledger/components/ui/classes';
import { Icon } from '@features/group-ledger/components/ui/IconButton';
import { StateScreen } from '@features/group-ledger/components/ui/StateScreen';
import {
  ReceiptEditor,
  discardReceiptDraft,
  useCurrencyStore,
  type SavedReceipt,
} from '@features/split-workspace';
import { navigate } from '@shared/routing';

interface GroupReceiptScreenProps {
  group: ReadyGroup;
  entryId?: EntryId;
}

export function GroupReceiptScreen({ group, entryId }: GroupReceiptScreenProps) {
  const { ledger } = group;
  const groupId = ledger.groupId;
  const live = entryId && ledger.entries.find((posted) => posted.entry.id === entryId);
  const [opened] = useState(() =>
    live && live.entry.kind === 'expense' ? { entry: live.entry, rev: live.rev } : null,
  );
  const notReceipt = opened !== null && opened.entry.basis.kind !== 'receipt';

  useEffect(() => {
    if (notReceipt && entryId)
      navigate({ kind: 'editExpense', groupId, entryId }, { replace: true });
  }, [notReceipt, groupId, entryId]);

  if (entryId !== undefined && opened === null) {
    return (
      <StateScreen icon="search_off" title="This receipt is gone">
        Someone deleted it, maybe on another phone.
      </StateScreen>
    );
  }
  if (notReceipt) return null;
  return <ReceiptForGroup group={group} editing={opened} />;
}

interface ReceiptForGroupProps {
  group: ReadyGroup;
  editing: { entry: ExpenseEntry; rev: OpId } | null;
}

function ReceiptForGroup({ group, editing }: ReceiptForGroupProps) {
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
  group: ReadyGroup;
  members: Member[];
  editing: { entry: ExpenseEntry; rev: OpId } | null;
  receipt: SavedReceipt;
  draftKey: string;
}

function SaveToGroup({ group, members, editing, receipt, draftKey }: SaveToGroupProps) {
  const { ledger, act } = group;
  const rates = useCurrencyStore((state) => state.exchangeRates);
  const [entryId] = useState(() => editing?.entry.id ?? newEntryId());
  const [payer, setPayer] = useState<MemberId>(
    () => editing?.entry.payment.payer ?? ledger.me ?? ledger.members[0].id,
  );
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
        <label className="relative flex min-w-0 flex-1 flex-col justify-center rounded-2xl py-1 pl-3 hover:bg-white/10">
          <span className="text-xs text-white/60">Paid by</span>
          <span className="flex items-center gap-0.5 truncate font-semibold">
            {payer === ledger.me
              ? 'You'
              : ledger.members.find((member) => member.id === payer)?.name}
            <Icon name="expand_more" className="text-lg!" />
          </span>
          <select
            aria-label="Paid by"
            value={payer}
            onChange={(event) => setPayer(event.target.value as MemberId)}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
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
