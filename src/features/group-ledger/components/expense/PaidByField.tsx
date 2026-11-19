import type { Ledger, Member } from '@features/group-ledger/domain/types';
import {
  amountsLeft,
  changePaidBy,
  type ExpenseDraft,
} from '@features/group-ledger/logic/expenseForm';
import { MemberAvatar } from '@features/group-ledger/components/ui/MemberAvatar';
import { MemberChip } from './MemberChip';
import { MoneyInput } from './MoneyInput';
import { Remainder } from './Remainder';

interface PaidByFieldProps {
  ledger: Ledger;
  members: Member[];
  draft: ExpenseDraft;
  onChange: (patch: Partial<ExpenseDraft>) => void;
}

export function PaidByField({ ledger, members, draft, onChange }: PaidByFieldProps) {
  const { paidBy } = draft;
  return (
    <section aria-labelledby="paid-by">
      <h2 id="paid-by" className="mb-2.5 section-label">
        Paid by
      </h2>
      <div className="flex flex-wrap gap-2">
        {members.map((member) => (
          <MemberChip
            key={member.id}
            ledger={ledger}
            memberId={member.id}
            selected={paidBy.kind === 'one' && paidBy.payer === member.id}
            onClick={() => onChange({ paidBy: { kind: 'one', payer: member.id } })}
          >
            {member.id === ledger.me ? 'You' : member.name}
          </MemberChip>
        ))}
        <MemberChip
          ledger={ledger}
          memberId={null}
          selected={paidBy.kind === 'several'}
          onClick={() => onChange({ paidBy: changePaidBy(draft, paidBy.kind !== 'several') })}
        >
          Several people
        </MemberChip>
      </div>
      {paidBy.kind === 'several' && (
        <div className="mt-3 surface-card p-2 motion-safe:animate-rise-in">
          <ul className="divide-y divide-surface-container-highest">
            {members.map((member) => (
              <li key={member.id} className="flex items-center gap-3 px-2 py-2">
                <MemberAvatar ledger={ledger} memberId={member.id} size="sm" />
                <span className="min-w-0 flex-1 truncate font-medium">{member.name}</span>
                <MoneyInput
                  aria-label={`${member.name} paid`}
                  currency={draft.currency}
                  value={paidBy.amounts[member.id] ?? ''}
                  onValueChange={(value) =>
                    onChange({
                      paidBy: {
                        kind: 'several',
                        amounts: { ...paidBy.amounts, [member.id]: value },
                      },
                    })
                  }
                />
              </li>
            ))}
          </ul>
          <Remainder
            cents={amountsLeft(draft.amount, paidBy.amounts)}
            currency={draft.currency}
            short="still unpaid"
          />
        </div>
      )}
    </section>
  );
}
