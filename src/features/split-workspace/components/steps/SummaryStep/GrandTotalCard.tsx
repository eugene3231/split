import { useState } from 'react';
import type { Person, Receipt } from '@shared/types';
import { formatMoneyAmount, getCurrencySymbol } from '@shared/logic/core/money';
import { ReceiptNameField } from '@features/split-workspace/components/shared/ReceiptNameField';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { cn } from '@shared/utils/cn';
import { PayNowField } from './PayNowField';

interface Props {
  totalLabel: string;
  grandTotal: number;
  displayCurrency: string;
  currentReceipt: Receipt | null;
  people: Person[];
  onRenameReceipt: (id: string, name: string) => void;
}

export function GrandTotalCard({
  totalLabel,
  grandTotal,
  displayCurrency,
  currentReceipt,
  people,
  onRenameReceipt,
}: Props) {
  const [showPayNow, setShowPayNow] = useState(false);
  const hasPayNowNumber = useReceiptStore((s) => s.payerMobile.trim() !== '');

  return (
    <div
      data-testid="grand-total-card"
      className="rounded-3xl bg-primary p-6 text-left text-on-primary shadow-md"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="min-w-0 flex-1 text-sm font-bold tracking-widest text-white uppercase">
          {currentReceipt ? (
            <ReceiptNameField
              key={currentReceipt.id}
              name={currentReceipt.name}
              onRename={(name) => onRenameReceipt(currentReceipt.id, name)}
              className="text-white placeholder:text-white/40"
              iconClassName="text-white"
            />
          ) : (
            totalLabel
          )}
        </span>
        <button
          type="button"
          aria-expanded={showPayNow}
          aria-controls={showPayNow ? 'payer-mobile' : undefined}
          onClick={() => setShowPayNow((open) => !open)}
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white transition-colors',
            showPayNow || hasPayNowNumber ? 'bg-white/25' : 'bg-white/10 hover:bg-white/20',
          )}
        >
          <PayNowIcon />
          PayNow
        </button>
      </div>
      <div className="mb-5 flex items-baseline gap-1">
        <span className="text-xl font-semibold text-white/60">
          {getCurrencySymbol(displayCurrency)}
        </span>
        <span className="font-headline text-4xl leading-none font-extrabold tracking-tight text-white tabular-nums">
          {formatMoneyAmount(grandTotal, displayCurrency)}
        </span>
      </div>

      {showPayNow && <PayNowField />}

      <div className="flex items-center gap-2.5 border-t border-white/10 pt-4">
        <span
          className="material-symbols-outlined !text-sm text-white/60"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          group
        </span>
        <span className="text-sm font-medium text-white">
          Split across {people.length} {people.length === 1 ? 'person' : 'people'}
        </span>
      </div>
    </div>
  );
}

function PayNowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
      <path d="M1 1h6v6H1zm1.5 1.5v3h3v-3zM9 1h6v6H9zm1.5 1.5v3h3v-3zM1 9h6v6H1zm1.5 1.5v3h3v-3z" />
      <path d="M3.25 3.25h1.5v1.5h-1.5zm8 0h1.5v1.5h-1.5zm-8 8h1.5v1.5h-1.5zM9 9h2v2H9zm2 2h2v2h-2zm2-2h2v2h-2zm-4 4h2v2H9zm4 0h2v2h-2z" />
    </svg>
  );
}
