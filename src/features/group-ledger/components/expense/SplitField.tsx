import type { Cents, MyLedger, Member, MemberId } from '@features/group-ledger/domain/types';
import {
  amountsLeft,
  changeSplitKind,
  type ExpenseDraft,
  type SplitBy,
} from '@features/group-ledger/logic/expenseForm';
import { memberLabel } from '@features/group-ledger/logic/describe';
import { Icon } from '@features/group-ledger/components/ui/IconButton';
import { MemberAvatar } from '@features/group-ledger/components/ui/MemberAvatar';
import { SegmentedToggle } from '@shared/components/SegmentedToggle';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { cn } from '@shared/utils/cn';
import { MoneyInput } from './MoneyInput';
import { Remainder } from './Remainder';

interface SplitFieldProps {
  ledger: MyLedger;
  members: Member[];
  draft: ExpenseDraft;
  owed: Record<MemberId, Cents> | null;
  onChange: (patch: Partial<ExpenseDraft>) => void;
}

export function SplitField({ ledger, members, draft, owed, onChange }: SplitFieldProps) {
  const { splitBy } = draft;
  const setSplit = (next: SplitBy) => onChange({ splitBy: next });
  const money = (cents: Cents) => formatCurrencyFromCents(cents, draft.currency);

  return (
    <section aria-labelledby="split-between">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h2 id="split-between" className="section-label">
          Split between
        </h2>
        <SegmentedToggle
          label="How to split"
          options={[
            { value: 'evenly', label: 'Evenly' },
            { value: 'unevenly', label: 'Unevenly' },
          ]}
          value={splitBy.kind === 'evenly' ? 'evenly' : 'unevenly'}
          onValueChange={(value) =>
            setSplit(changeSplitKind(splitBy, value === 'evenly' ? 'evenly' : 'shares'))
          }
          className="[&>button]:px-3.5 [&>button]:py-1.5"
        />
      </div>

      {splitBy.kind === 'evenly' ? (
        <>
          <ul className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-5">
            {members.map((member) => {
              const included = splitBy.between.includes(member.id);
              return (
                <li key={member.id}>
                  <button
                    type="button"
                    aria-pressed={included}
                    onClick={() =>
                      setSplit({
                        kind: 'evenly',
                        between: included
                          ? splitBy.between.filter((id) => id !== member.id)
                          : [...splitBy.between, member.id],
                      })
                    }
                    className="flex w-full flex-col items-center gap-1.5 rounded-2xl py-1 transition active:scale-95"
                  >
                    <span className="relative">
                      <MemberAvatar
                        ledger={ledger}
                        memberId={member.id}
                        size="lg"
                        className={cn('transition', !included && 'opacity-30 grayscale')}
                      />
                      {included && (
                        <span className="absolute -right-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-on-primary ring-2 ring-surface motion-safe:animate-pop-in">
                          <Icon name="check" className="text-sm!" />
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        'w-full truncate text-center text-xs font-semibold',
                        included ? 'text-on-surface' : 'text-on-surface-variant',
                      )}
                    >
                      {memberLabel(ledger, member.id)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-center text-sm text-on-surface-variant">
            {splitBy.between.length === 0
              ? 'Tap the people who share it'
              : owed
                ? `${money(Math.max(...Object.values(owed)))} each · ${splitBy.between.length} ${splitBy.between.length === 1 ? 'person' : 'people'}`
                : `${splitBy.between.length} ${splitBy.between.length === 1 ? 'person' : 'people'}`}
          </p>
        </>
      ) : (
        <div className="surface-card p-2 motion-safe:animate-rise-in">
          <SegmentedToggle
            label="Split by"
            options={[
              { value: 'shares', label: 'Shares' },
              { value: 'amounts', label: 'Amounts' },
            ]}
            value={splitBy.kind}
            onValueChange={(kind) => setSplit(changeSplitKind(splitBy, kind))}
            className="m-1 [&>button]:px-4 [&>button]:py-1.5"
          />
          <ul className="mt-1 divide-y divide-surface-container-highest">
            {members.map((member) => (
              <li key={member.id} className="flex items-center gap-3 px-2 py-2">
                <MemberAvatar ledger={ledger} memberId={member.id} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{member.name}</span>
                  {splitBy.kind === 'shares' && owed?.[member.id] !== undefined && (
                    <span className="block text-xs text-on-surface-variant tabular-nums">
                      {money(owed[member.id])}
                    </span>
                  )}
                </span>
                {splitBy.kind === 'shares' ? (
                  <Stepper
                    name={member.name}
                    value={splitBy.weights[member.id] ?? 0}
                    onChange={(weight) =>
                      setSplit({
                        kind: 'shares',
                        weights: { ...splitBy.weights, [member.id]: weight },
                      })
                    }
                  />
                ) : (
                  <MoneyInput
                    aria-label={`${member.name} owes`}
                    currency={draft.currency}
                    value={splitBy.amounts[member.id] ?? ''}
                    onValueChange={(value) =>
                      setSplit({
                        kind: 'amounts',
                        amounts: { ...splitBy.amounts, [member.id]: value },
                      })
                    }
                  />
                )}
              </li>
            ))}
          </ul>
          {splitBy.kind === 'amounts' && (
            <Remainder
              cents={amountsLeft(draft.amount, splitBy.amounts)}
              currency={draft.currency}
              short="left to split"
            />
          )}
        </div>
      )}
    </section>
  );
}

function Stepper({
  name,
  value,
  onChange,
}: {
  name: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const step =
    'flex size-9 items-center justify-center rounded-full text-on-surface transition hover:bg-surface-container-high active:scale-90 disabled:opacity-30';
  return (
    <div className="flex shrink-0 items-center rounded-full bg-surface-container p-0.5">
      <button
        type="button"
        aria-label={`Fewer shares for ${name}`}
        className={step}
        disabled={value === 0}
        onClick={() => onChange(value - 1)}
      >
        <Icon name="remove" className="text-lg!" />
      </button>
      <span
        aria-label={`${name}'s shares`}
        className="w-7 text-center text-sm font-bold tabular-nums"
      >
        {value}
      </span>
      <button
        type="button"
        aria-label={`More shares for ${name}`}
        className={step}
        onClick={() => onChange(value + 1)}
      >
        <Icon name="add" className="text-lg!" />
      </button>
    </div>
  );
}
