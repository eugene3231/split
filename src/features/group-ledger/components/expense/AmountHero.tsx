import { CURRENCY_CODES, type CurrencyCode } from '@shared/constants';
import {
  formatCurrencyFromCents,
  parseCurrencyToCents,
  parseNumber,
} from '@shared/logic/core/money';
import type { ExpenseDraft } from '@features/group-ledger/logic/expenseForm';
import { Icon } from '@features/group-ledger/components/ui/IconButton';
import { PillSelect } from '@features/group-ledger/components/ui/PillSelect';

const CURRENCY_OPTIONS = CURRENCY_CODES.map((code) => ({ value: code, label: code }));

interface AmountHeroProps {
  draft: ExpenseDraft;
  groupCurrency: CurrencyCode;
  onChange: (patch: Partial<ExpenseDraft>) => void;
  onCurrencyChange: (currency: CurrencyCode) => void;
}

export function AmountHero({ draft, groupCurrency, onChange, onCurrencyChange }: AmountHeroProps) {
  const foreign = draft.currency !== groupCurrency;
  const cents = parseCurrencyToCents(draft.amount);
  const rate = parseNumber(draft.rate);

  return (
    <section className="flex flex-col items-center">
      <PillSelect
        label="Currency"
        value={draft.currency}
        options={CURRENCY_OPTIONS}
        onChange={onCurrencyChange}
        className="flex h-9 items-center gap-1 rounded-full bg-surface-container pr-2.5 pl-3.5 text-sm font-semibold transition hover:bg-surface-container-high"
      >
        {draft.currency}
        <Icon name="expand_more" className="text-lg!" />
      </PillSelect>
      <input
        aria-label="Amount"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={draft.amount}
        onChange={(event) => onChange({ amount: event.target.value })}
        className="mt-2 w-full bg-transparent text-center font-headline text-[3.25rem] leading-tight font-bold tracking-tight tabular-nums outline-none placeholder:text-outline-variant"
      />
      {foreign && (
        <div className="mt-1 flex items-center gap-2 text-sm text-on-surface-variant motion-safe:animate-fade-in">
          <span>1 {draft.currency} =</span>
          <input
            aria-label={`${groupCurrency} per ${draft.currency}`}
            type="text"
            inputMode="decimal"
            value={draft.rate}
            onChange={(event) => onChange({ rate: event.target.value })}
            className="h-8 w-20 field px-2 text-center text-on-surface tabular-nums outline-none"
          />
          <span>{groupCurrency}</span>
          {cents !== null && cents > 0 && rate !== null && rate > 0 && (
            <span className="font-semibold text-on-surface">
              ≈ {formatCurrencyFromCents(Math.round(cents * rate), groupCurrency)}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
