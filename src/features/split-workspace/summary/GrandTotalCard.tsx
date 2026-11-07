import { useState } from 'react';
import type { Person, Receipt } from '@shared/types';
import { formatMoneyAmount, getCurrencySymbol } from '@shared/logic/core/money';
import { ReceiptNameField } from '@features/split-workspace/components/shared/ReceiptNameField';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { cn } from '@shared/utils/cn';
import { PayNowField } from './PayNowField';
import type { PayNowStatus } from './useSummaryModel';
import { CheckIcon } from '@features/split-workspace/components/shared/CheckIcon';
import type { CurrencyCode } from '@shared/constants';

interface Props {
  payNowStatus: PayNowStatus;
  totalLabel: string;
  grandTotal: number;
  displayCurrency: CurrencyCode;
  currentReceipt: Receipt | null;
  people: Person[];
  /** Overview has no person cards, so the PayNow note points back to By person. */
  showsPersonCards: boolean;
  onRenameReceipt: (id: string, name: string) => void;
}

export function GrandTotalCard({
  payNowStatus,
  totalLabel,
  grandTotal,
  displayCurrency,
  currentReceipt,
  people,
  showsPersonCards,
  onRenameReceipt,
}: Props) {
  const [showPayNow, setShowPayNow] = useState(false);
  const statusMessage = getPayNowStatusMessage(payNowStatus, showsPersonCards);
  const hasPayNowError = payNowStatus === 'invalid' || payNowStatus === 'failed';
  const hasPayNowNumber = useReceiptStore((s) => s.payerMobile.trim() !== '');

  return (
    <div
      data-testid="grand-total-card"
      className="rounded-card bg-primary px-4 py-3.5 text-left text-on-primary sm:px-5 sm:py-4"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 flex-1 text-sm font-semibold text-white/80">
          {currentReceipt ? (
            <ReceiptNameField
              key={currentReceipt.id}
              name={currentReceipt.name}
              onRename={(name) => onRenameReceipt(currentReceipt.id, name)}
              className="text-white/80 placeholder:text-white/40"
              iconClassName="text-white/60"
            />
          ) : (
            totalLabel
          )}
        </span>
        <button
          type="button"
          aria-expanded={showPayNow}
          aria-describedby={statusMessage ? 'paynow-status' : undefined}
          aria-controls={showPayNow ? 'payer-mobile' : undefined}
          onClick={() => setShowPayNow((open) => !open)}
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-white transition-colors',
            showPayNow || hasPayNowNumber ? 'bg-white/25' : 'bg-white/10 hover:bg-white/20',
          )}
        >
          <PayNowIcon />
          PayNow
        </button>
      </div>
      <p className="mt-1 flex items-baseline gap-1">
        <span className="text-lg font-semibold text-white/60">
          {getCurrencySymbol(displayCurrency)}
        </span>
        <span className="font-headline text-[2rem] leading-none font-bold tracking-tight text-white tabular-nums">
          {formatMoneyAmount(grandTotal, displayCurrency)}
        </span>
      </p>
      <p className="mt-2 flex items-center gap-1.5 text-sm text-white/70">
        <span
          aria-hidden="true"
          className="material-symbols-outlined !text-base"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          group
        </span>
        Split across {people.length} {people.length === 1 ? 'person' : 'people'}
      </p>

      {(showPayNow || statusMessage) && (
        <div className="mt-3 border-t border-white/10 pt-3">
          {showPayNow && <PayNowField invalid={payNowStatus === 'invalid'} />}
          <p
            id="paynow-status"
            role={statusMessage ? 'status' : undefined}
            aria-atomic="true"
            className={cn(
              'flex items-start gap-1.5 text-xs leading-relaxed',
              showPayNow && 'mt-1.5',
              hasPayNowError
                ? 'text-red-300'
                : payNowStatus === 'ready'
                  ? 'text-secondary-container'
                  : 'text-white/50',
            )}
          >
            <PayNowStatusIcon status={payNowStatus} />
            {statusMessage ??
              "Enter the bill payer's number to add a PayNow QR code to each person's card."}
          </p>
        </div>
      )}
    </div>
  );
}

function PayNowStatusIcon({ status }: { status: PayNowStatus }) {
  if (status === 'ready') {
    return (
      <CheckIcon
        role="img"
        aria-label="PayNow QR codes ready"
        strokeWidth="2.5"
        className="mt-0.5 h-3.5 w-3.5 shrink-0 motion-safe:animate-pop-in"
      />
    );
  }
  if (status !== 'invalid' && status !== 'failed') return null;
  return (
    <svg
      key={status}
      role="img"
      aria-label={status === 'invalid' ? 'PayNow number invalid' : 'PayNow QR generation failed'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 h-3.5 w-3.5 shrink-0"
    >
      <path d="m6 6 12 12M6 18 18 6" />
    </svg>
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

function getPayNowStatusMessage(status: PayNowStatus, showsPersonCards: boolean): string | null {
  switch (status) {
    case 'empty':
      return null;
    case 'invalid':
      return 'Enter a valid SG mobile number, e.g. +65 9123 4567';
    case 'generating':
      return 'Generating PayNow QR codes…';
    case 'ready':
      return showsPersonCards
        ? "PayNow QR codes are at the bottom of each person's card."
        : 'PayNow QR codes are in By person.';
    case 'unavailable':
      return 'No QR codes yet. No one has an amount to pay.';
    case 'failed':
      return "Couldn't generate all PayNow QR codes. Clear the number and enter it again.";
  }
}
