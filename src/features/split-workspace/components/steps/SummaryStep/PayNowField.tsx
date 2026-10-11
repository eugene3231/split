import { useState } from 'react';
import { normalizeMobile } from '@features/payments';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';

export function PayNowField() {
  const [mobileError, setMobileError] = useState<string | null>(null);
  const payerMobile = useReceiptStore((s) => s.payerMobile);
  const setPayerMobile = useReceiptStore((s) => s.setPayerMobile);

  const handleChange = (value: string) => {
    setPayerMobile(value);
    setMobileError(null);
  };

  const handleBlur = () => {
    if (payerMobile.trim() && !normalizeMobile(payerMobile)) {
      setMobileError('Enter a valid SG mobile number, e.g. +65 9123 4567');
    }
  };

  return (
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
        // Only mounted when the PayNow button is tapped, so typing can start straight away.
        autoFocus
        value={payerMobile}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        placeholder="9123 4567"
        className="w-full rounded-xl bg-white/10 px-3 py-2 text-base font-medium text-white outline-none placeholder:text-white/30 focus:ring-2 focus:ring-white/30"
      />
      {mobileError ? (
        <p className="mt-1 text-xs text-red-300">{mobileError}</p>
      ) : (
        <p className="mt-1.5 text-xs text-white/50">
          Generates a PayNow QR per person so everyone can pay the bill payer back.
        </p>
      )}
    </div>
  );
}
