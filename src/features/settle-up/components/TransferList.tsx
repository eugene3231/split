import { useState } from 'react';
import { normalizeMobile, PaynowQr } from '@features/payments';
import { PersonAvatar } from '@features/split-workspace/components/shared/PersonAvatar';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import type { Person } from '@shared/types';
import { cn } from '@shared/utils/cn';
import { getTransferKey, type Transfer } from '../logic/settleUp';

interface TransferListProps {
  people: Person[];
  transfers: Transfer[];
  settledKeys: Set<string>;
  mobileByPersonId: Record<string, string>;
  onToggleSettled: (key: string) => void;
}

export function TransferList({
  people,
  transfers,
  settledKeys,
  mobileByPersonId,
  onToggleSettled,
}: TransferListProps) {
  if (transfers.length === 0) {
    return (
      <div className="rounded-2xl bg-surface-container-lowest p-6 text-center shadow-sm">
        <span className="material-symbols-outlined text-4xl text-secondary">check_circle</span>
        <p className="mt-2 font-semibold text-on-surface">Everyone is square</p>
        <p className="text-sm text-on-surface-variant">
          Mark who paid each receipt to see who owes whom.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {transfers.map((transfer) => {
        const key = getTransferKey(transfer);
        return (
          <TransferRow
            key={key}
            people={people}
            transfer={transfer}
            settled={settledKeys.has(key)}
            creditorMobile={normalizeMobile(mobileByPersonId[transfer.toPersonId] ?? '')}
            onToggleSettled={() => onToggleSettled(key)}
          />
        );
      })}
    </ul>
  );
}

interface TransferRowProps {
  people: Person[];
  transfer: Transfer;
  settled: boolean;
  creditorMobile: string | null;
  onToggleSettled: () => void;
}

function TransferRow({
  people,
  transfer,
  settled,
  creditorMobile,
  onToggleSettled,
}: TransferRowProps) {
  const [showQr, setShowQr] = useState(false);
  const fromIndex = people.findIndex((p) => p.id === transfer.fromPersonId);
  const toIndex = people.findIndex((p) => p.id === transfer.toPersonId);
  const from = people[fromIndex];
  const to = people[toIndex];

  return (
    <li
      className={cn(
        'rounded-2xl bg-surface-container-lowest p-4 shadow-sm transition-opacity',
        settled && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-3">
        <PersonAvatar name={from.name} colorIndex={fromIndex} />
        <span className="material-symbols-outlined text-on-surface-variant">arrow_forward</span>
        <PersonAvatar name={to.name} colorIndex={toIndex} />
        <p className={cn('min-w-0 flex-1 text-sm text-on-surface', settled && 'line-through')}>
          <span className="font-semibold">{from.name}</span> pays{' '}
          <span className="font-semibold">{to.name}</span>
        </p>
        <p className="font-headline text-lg font-extrabold text-primary">
          {formatCurrencyFromCents(transfer.amountCents)}
        </p>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          aria-pressed={settled}
          onClick={onToggleSettled}
          className={cn(
            'flex-1 rounded-full py-2 text-sm font-bold transition-colors',
            settled
              ? 'bg-secondary-container text-on-secondary-container'
              : 'bg-surface-container text-on-surface hover:bg-surface-container-high',
          )}
        >
          {settled ? 'Paid' : 'Mark paid'}
        </button>
        {creditorMobile && !settled && (
          <button
            type="button"
            aria-expanded={showQr}
            onClick={() => setShowQr((v) => !v)}
            className="flex-1 rounded-full bg-[#7E197E] py-2 text-sm font-bold text-white"
          >
            {showQr ? 'Hide QR' : 'PayNow QR'}
          </button>
        )}
      </div>
      {creditorMobile && showQr && !settled && (
        <div className="mt-4">
          <PaynowQr mobile={creditorMobile} amountCents={transfer.amountCents} />
        </div>
      )}
    </li>
  );
}
