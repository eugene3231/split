import { PersonAvatar } from '@features/split-workspace/components/shared/PersonAvatar';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import type { Person } from '@shared/types';
import { cn } from '@shared/utils/cn';
import { getReceiptTotalCents, type SettleUpReceipt } from '../logic/settleUp';

interface PayerPickerProps {
  receipt: SettleUpReceipt;
  people: Person[];
  payerId: string | undefined;
  onPayerChange: (personId: string) => void;
}

export function PayerPicker({ receipt, people, payerId, onPayerChange }: PayerPickerProps) {
  return (
    <fieldset className="rounded-2xl bg-surface-container-lowest p-4 shadow-sm">
      <legend className="sr-only">Who paid for {receipt.name}?</legend>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="truncate font-bold text-on-surface">{receipt.name}</p>
        <p className="font-headline shrink-0 font-extrabold text-primary">
          {formatCurrencyFromCents(getReceiptTotalCents(receipt))}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {people.map((person, index) => {
          const selected = person.id === payerId;
          return (
            <label
              key={person.id}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm font-semibold transition-colors',
                selected
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-outline-variant text-on-surface-variant hover:bg-surface-container',
              )}
            >
              <input
                type="radio"
                name={`payer-${receipt.id}`}
                className="sr-only"
                checked={selected}
                onChange={() => onPayerChange(person.id)}
              />
              <PersonAvatar name={person.name} colorIndex={index} size="sm" />
              {person.name}
            </label>
          );
        })}
      </div>
      {!payerId && (
        <p className="mt-3 text-xs text-on-surface-variant">Pick who paid to count this receipt.</p>
      )}
    </fieldset>
  );
}
