import { useState } from 'react';
import type { CurrencyCode } from '@shared/constants';
import type { ExpenseEntry, OpId } from '@features/group-ledger/domain/types';
import type { ReadyGroup } from '@features/group-ledger/hooks/useGroup';
import {
  blankDraft,
  checkExpense,
  draftFromEntry,
  formMembers,
  rateInput,
  type ExpenseDraft,
} from '@features/group-ledger/logic/expenseForm';
import { asLocalDate, newEntryId, todayLocalDate } from '@features/group-ledger/logic/ids';
import { totalCents } from '@features/group-ledger/logic/post';
import { showToast } from '@features/group-ledger/stores/toastStore';
import { ActionBar } from '@features/group-ledger/components/ui/ActionBar';
import { actionBarButtonClass } from '@features/group-ledger/components/ui/classes';
import { Icon, IconButton } from '@features/group-ledger/components/ui/IconButton';
import { ScreenHeader, ScreenTitle } from '@features/group-ledger/components/ui/ScreenHeader';
import { TextField } from '@features/group-ledger/components/ui/TextField';
import { useCurrencyStore } from '@features/split-workspace';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { navigate } from '@shared/routing';
import { AmountHero } from './AmountHero';
import { PaidByField } from './PaidByField';
import { SplitField } from './SplitField';

interface ExpenseFormProps {
  group: ReadyGroup;
  /** The expense being edited and the revision it was opened at; nothing for a new one. */
  editing?: { entry: ExpenseEntry; rev: OpId };
}

export function ExpenseForm({ group, editing }: ExpenseFormProps) {
  const { ledger, act } = group;
  const rates = useCurrencyStore((state) => state.exchangeRates);
  const [entryId] = useState(() => editing?.entry.id ?? newEntryId());
  const [draft, setDraft] = useState<ExpenseDraft>(() =>
    editing
      ? draftFromEntry(editing.entry)
      : blankDraft(
          ledger.members,
          ledger.me ?? ledger.members[0].id,
          ledger.currency,
          todayLocalDate(),
        ),
  );
  const check = checkExpense(draft, entryId, ledger.currency);
  const members = formMembers(ledger.members, draft);
  const change = (patch: Partial<ExpenseDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const back = () => navigate({ kind: 'group', groupId: ledger.groupId });

  const save = () => {
    if (!check.ok) return;
    if (editing) act.editEntry(check.entry, editing.rev);
    else act.addExpense(check.entry);
    back();
    showToast(`${editing ? 'Saved' : 'Added'} ${check.entry.title}`);
  };

  const remove = () => {
    if (!editing) return;
    const removedBy = act.removeEntry(editing.entry.id, editing.rev);
    back();
    showToast(`Deleted ${editing.entry.title}`, {
      label: 'Undo',
      run: () => act.editEntry(editing.entry, removedBy),
    });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-surface font-body text-on-surface">
      <ScreenHeader
        back={{ kind: 'group', groupId: ledger.groupId }}
        backLabel={`Back to ${ledger.name}`}
        title={<ScreenTitle>{editing ? 'Edit expense' : 'New expense'}</ScreenTitle>}
      >
        {editing && (
          <IconButton
            label="Delete expense"
            icon="delete"
            onClick={remove}
            className="hover:text-error"
          />
        )}
      </ScreenHeader>

      <main className="mx-auto w-full max-w-xl flex-1 space-y-7 px-4 pt-6 pb-8 motion-safe:animate-slide-in-forward">
        <AmountHero
          draft={draft}
          groupCurrency={ledger.currency}
          onChange={change}
          onCurrencyChange={(currency: CurrencyCode) =>
            change({ currency, rate: rateInput(currency, ledger.currency, rates) })
          }
        />

        <div className="space-y-3">
          <TextField
            label="What was it for?"
            value={draft.title}
            onChange={(event) => change({ title: event.target.value })}
            placeholder="e.g. Dinner at Lau Pa Sat"
            maxLength={80}
          />
          <label className="inline-flex h-10 items-center gap-2 rounded-full bg-surface-container px-3.5 text-sm font-semibold transition focus-within:ring-2 focus-within:ring-primary/20">
            <span className="sr-only">Date</span>
            <input
              type="date"
              value={draft.date}
              max={todayLocalDate()}
              onChange={(event) =>
                event.target.value && change({ date: asLocalDate(event.target.value) })
              }
              className="bg-transparent outline-none"
            />
          </label>
        </div>

        <PaidByField ledger={ledger} members={members} draft={draft} onChange={change} />
        <SplitField
          ledger={ledger}
          members={members}
          draft={draft}
          owed={check.ok ? check.entry.owed : null}
          onChange={change}
        />
      </main>

      <ActionBar
        status={
          check.ok ? (
            <>
              <span className="text-xs text-white/60">Total</span>
              <span className="truncate font-headline text-xl leading-tight font-bold tabular-nums">
                {formatCurrencyFromCents(totalCents(check.entry), check.entry.currency)}
              </span>
            </>
          ) : (
            <span className="text-sm text-white/70">{check.reason}</span>
          )
        }
      >
        <button
          type="button"
          disabled={!check.ok}
          onClick={save}
          className={actionBarButtonClass(check.ok)}
        >
          {editing ? 'Save' : 'Add'}
          <Icon name="check" className="text-lg!" />
        </button>
      </ActionBar>
    </div>
  );
}
