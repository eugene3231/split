import { useState } from 'react';
import type { Person, Receipt } from '@shared/types';
import { getCurrencySymbol } from '@shared/logic/core/money';
import { normalizeMobile } from '@features/payments';
import { ReceiptNameField } from '@features/workspace/components/shared/ReceiptNameField';
import { useReceiptStore } from '@features/workspace/stores/receiptStore';

interface Props {
  grandTotal: number;
  displayCurrency: string;
  currentReceipt: Receipt | null;
  people: Person[];
  onRenameReceipt: (id: string, name: string) => void;
}

export function GrandTotalCard({
  grandTotal,
  displayCurrency,
  currentReceipt,
  people,
  onRenameReceipt,
}: Props) {
  const [mobileError, setMobileError] = useState<string | null>(null);
  const payerMobile = useReceiptStore((s) => s.payerMobile);
  const setPayerMobile = useReceiptStore((s) => s.setPayerMobile);

  const handlePayerMobileChange = (value: string) => {
    setPayerMobile(value);
    setMobileError(null);
  };

  const handlePayerMobileBlur = () => {
    if (payerMobile.trim() && !normalizeMobile(payerMobile)) {
      setMobileError('Enter a valid SG mobile number, e.g. +65 9123 4567');
    }
  };

  return (
    <div
      className="rounded-2xl p-6 text-left shadow-md"
      style={{ background: 'linear-gradient(135deg, #2d6a7f 0%, #1e5068 100%)' }}
    >
      <div className="mb-4 flex items-start justify-between">
        <span className="mr-2 min-w-0 flex-1 text-sm font-bold tracking-widest text-white uppercase">
          {currentReceipt ? (
            <ReceiptNameField
              key={currentReceipt.id}
              name={currentReceipt.name}
              onRename={(name) => onRenameReceipt(currentReceipt.id, name)}
              className="text-white placeholder:text-white/40"
              iconClassName="text-white"
            />
          ) : (
            'Grand Total'
          )}
        </span>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10">
          <span className="material-symbols-outlined text-sm text-white/50">
            account_balance_wallet
          </span>
        </div>
      </div>
      <div className="mb-5 flex items-baseline gap-1">
        <span className="text-xl font-semibold text-white/60">
          {getCurrencySymbol(displayCurrency)}
        </span>
        <span className="font-headline text-4xl leading-none font-semibold text-white">
          {(grandTotal / 100).toFixed(2)}
        </span>
      </div>

      <div className="mb-4">
        <label
          htmlFor="payer-mobile"
          className="mb-1.5 block text-xs font-semibold tracking-widest text-white/60 uppercase"
        >
          PayNow Number
        </label>
        <input
          id="payer-mobile"
          type="tel"
          value={payerMobile}
          onChange={(e) => handlePayerMobileChange(e.target.value)}
          onBlur={handlePayerMobileBlur}
          placeholder="9123 4567"
          className="w-full rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white outline-none placeholder:text-white/30 focus:ring-2 focus:ring-white/30"
        />
        {mobileError ? (
          <p className="mt-1 text-xs text-red-300">{mobileError}</p>
        ) : (
          <p className="mt-1.5 text-xs text-white/50">
            Generates a PayNow QR per person so everyone can pay the bill payer back.
          </p>
        )}
      </div>

      <div className="flex items-center gap-2.5 border-t border-white/10 pt-4">
        <span
          className="material-symbols-outlined !text-sm text-cyan-300"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          verified
        </span>
        <span className="text-sm font-medium text-white">
          Fully reconciled across {people.length} {people.length === 1 ? 'person' : 'people'}
        </span>
      </div>
    </div>
  );
}
