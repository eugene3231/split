import { useHoldAppUpdate } from '@features/group-ledger/hooks/useHoldAppUpdate';
import { useState } from 'react';
import type { OpId, TransferEntry } from '@features/group-ledger/domain/types';
import type { MyGroup } from '@features/group-ledger/hooks/useGroup';
import { dateLabel } from '@features/group-ledger/logic/dates';
import { transferTitle } from '@features/group-ledger/logic/describe';
import { todayLocalDate } from '@features/group-ledger/logic/ids';
import { showToast } from '@features/group-ledger/stores/toastStore';
import { ActionBar } from '@features/group-ledger/components/ui/ActionBar';
import { actionBarButtonClass } from '@features/group-ledger/components/ui/classes';
import { Icon, IconButton } from '@features/group-ledger/components/ui/IconButton';
import { MemberAvatar } from '@features/group-ledger/components/ui/MemberAvatar';
import { ScreenHeader, ScreenTitle } from '@features/group-ledger/components/ui/ScreenHeader';
import { parseCurrencyToCents } from '@shared/logic/core/money';
import { amountInput } from '@features/group-ledger/logic/expenseForm';
import { navigate } from '@shared/routing';

interface TransferEditorProps {
  group: MyGroup;
  transfer: TransferEntry;
  rev: OpId;
}

export function TransferEditor({ group, transfer, rev }: TransferEditorProps) {
  const { ledger, act } = group;
  useHoldAppUpdate();
  const [amount, setAmount] = useState(() => amountInput(transfer.cents, ledger.currency));
  const cents = parseCurrencyToCents(amount);
  const valid = cents !== null && cents > 0;
  const changed = valid && cents !== transfer.cents;
  const title = transferTitle(ledger, transfer);
  const back = () => navigate({ kind: 'group', groupId: ledger.groupId });

  const remove = () => {
    const removedBy = act.removeEntry(transfer.id, rev);
    back();
    showToast(`Deleted ${title}`, { label: 'Undo', run: () => act.editEntry(transfer, removedBy) });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-surface font-body text-on-surface">
      <ScreenHeader
        back={{ kind: 'group', groupId: ledger.groupId }}
        backLabel={`Back to ${ledger.name}`}
        title={<ScreenTitle>Payment</ScreenTitle>}
      >
        <IconButton
          label="Delete payment"
          icon="delete"
          onClick={remove}
          className="hover:text-error"
        />
      </ScreenHeader>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-4 pt-10 text-center motion-safe:animate-slide-in-forward">
        <div className="flex items-center gap-3">
          <MemberAvatar ledger={ledger} memberId={transfer.from} size="lg" />
          <Icon name="arrow_forward" className="text-outline" />
          <MemberAvatar ledger={ledger} memberId={transfer.to} size="lg" />
        </div>
        <h1 className="mt-4 font-headline text-xl font-bold">{title}</h1>
        <p className="text-sm text-on-surface-variant">
          {dateLabel(transfer.date, todayLocalDate())}
        </p>
        <input
          aria-label="Amount"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="mt-6 w-full bg-transparent text-center font-headline text-[3.25rem] leading-tight font-bold tabular-nums outline-none"
        />
        <p className="text-sm text-on-surface-variant">{ledger.currency}</p>
      </main>
      <ActionBar
        status={
          <span className="text-sm text-white/70">
            {valid ? 'Change the amount if it was different' : 'Enter an amount'}
          </span>
        }
      >
        <button
          type="button"
          disabled={!changed}
          className={actionBarButtonClass(changed)}
          onClick={() => {
            if (!changed) return;
            act.editEntry({ ...transfer, cents }, rev);
            back();
            showToast(`Saved ${title}`);
          }}
        >
          Save
        </button>
      </ActionBar>
    </div>
  );
}
