import { useState } from 'react';
import type { Person, Receipt } from '@shared/types';
import { getCurrencySymbol } from '@shared/logic/core/money';
import { ReceiptNameField } from '@pages/components/workspace/shared/ReceiptNameField';
import { normalizeMobile } from '@shared/logic/core/paynow';
import { useReceiptStore } from '@shared/stores/receiptStore';

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
      <div className="flex items-start justify-between mb-4">
        <span className="text-sm font-bold uppercase tracking-widest text-white flex-1 min-w-0 mr-2">
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
        <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-white/50 text-sm">
            account_balance_wallet
          </span>
        </div>
      </div>
      <div className="flex items-baseline gap-1 mb-5">
        <span className="text-xl font-semibold text-white/60">
          {getCurrencySymbol(displayCurrency)}
        </span>
        <span className="text-4xl font-semibold text-white font-headline leading-none">
          {(grandTotal / 100).toFixed(2)}
        </span>
      </div>

      <div className="mb-4">
        <label
          htmlFor="payer-mobile"
          className="block text-xs font-semibold text-white/60 uppercase tracking-widest mb-1.5"
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
          className="w-full bg-white/10 text-white placeholder:text-white/30 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-white/30"
        />
        {mobileError ? (
          <p className="text-xs text-red-300 mt-1">{mobileError}</p>
        ) : (
          <p className="text-xs text-white/50 mt-1.5">
            Generates a PayNow QR per person so everyone can pay the bill payer back.
          </p>
        )}
      </div>

      <div className="border-t border-white/10 pt-4 flex items-center gap-2.5">
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
