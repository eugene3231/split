import { useState } from 'react';
import type {
  EditingExpense,
  ExpenseEntry,
  Member,
  MemberId,
  OpId,
} from '@features/group-ledger/domain/types';
import type { MyGroup } from '@features/group-ledger/hooks/useGroup';
import { TOO_BIG, entryFits, receiptRate } from '@features/group-ledger/logic/expenseForm';
import { newEntryId, todayLocalDate } from '@features/group-ledger/logic/ids';
import { memberLabel } from '@features/group-ledger/logic/describe';
import { keepAsWritten, keepSavedCents, postReceipt } from '@features/group-ledger/logic/post';
import { showToast } from '@features/group-ledger/stores/toastStore';
import { actionBarButtonClass } from '@features/group-ledger/components/ui/classes';
import { Icon } from '@features/group-ledger/components/ui/IconButton';
import { PillSelect } from '@features/group-ledger/components/ui/PillSelect';
import { ReceiptEditor, useCurrencyStore, type SavedReceipt } from '@features/split-workspace';
import { navigate } from '@shared/routing';
import { discardGroupReceiptDraft, receiptDraftBase } from './receiptDraftBase';

const initialReceipt = (entry: ExpenseEntry) =>
  entry.basis.kind === 'receipt' ? entry.basis.receipt : undefined;

interface GroupReceiptEditorProps {
  group: MyGroup;
  editing: EditingExpense | null;
}

export function GroupReceiptEditor({ group, editing }: GroupReceiptEditorProps) {
  const { ledger } = group;
  // Fixed when the editor opens, as its people are: a member archived on another phone meanwhile
  // stays in the split rather than dropping out of it at save, leaving the others their share.
  const [members] = useState(() => {
    const holders = new Set(editing ? Object.keys(editing.entry.owed) : []);
    return ledger.members.filter((member) => !member.archived || holders.has(member.id));
  });
  const draftKey = `group:${ledger.groupId}:receipt:${editing?.entry.id ?? 'new'}`;
  const back = () => navigate({ kind: 'group', groupId: ledger.groupId });
  const initial = editing ? initialReceipt(editing.entry) : undefined;
  const [base] = useState(() => editing && receiptDraftBase(draftKey, editing.rev));
  const [payer, setPayer] = useState<MemberId>(() => editing?.entry.payment.payer ?? ledger.me);

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
          base={base}
          payer={payer}
          onPayerChange={setPayer}
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
  editing: EditingExpense | null;
  /** The revision the draft began on; null for a new receipt. */
  base: OpId | null;
  /** Held by the editor, which stays mounted across steps, so going back keeps the pick. */
  payer: MemberId;
  onPayerChange: (payer: MemberId) => void;
  receipt: SavedReceipt;
  draftKey: string;
}

function SaveToGroup({
  group,
  members,
  editing,
  base,
  payer,
  onPayerChange,
  receipt,
  draftKey,
}: SaveToGroupProps) {
  const { ledger, act } = group;
  const rates = useCurrencyStore((state) => state.exchangeRates);
  const [entryId] = useState(() => editing?.entry.id ?? newEntryId());
  const saved = editing && {
    currency: editing.entry.currency,
    override: initialReceipt(editing.entry)?.exchangeRateOverride ?? null,
    rate: editing.entry.rate,
  };
  const posted = postReceipt(
    {
      id: entryId,
      title: receipt.name.trim() || 'Receipt',
      date: editing?.entry.date ?? todayLocalDate(),
      currency: receipt.currency,
      rate: receiptRate(
        { currency: receipt.currency, override: receipt.exchangeRateOverride },
        ledger.currency,
        rates,
        saved,
      ),
      payment: { payer, others: {} },
    },
    receipt,
    members,
  );
  const kept = posted && keepSavedCents(posted, editing?.entry ?? null);
  const entry = kept && editing ? keepAsWritten(kept, editing.entry, editing.written) : kept;

  const fits = entry !== null && entryFits(entry);

  const save = () => {
    if (entry === null || !fits) return;
    if (base !== null) act.editEntry(entry, base);
    else act.addExpense(entry);
    discardGroupReceiptDraft(draftKey);
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
          onChange={onPayerChange}
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
