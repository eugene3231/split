import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';

interface Props {
  invalid: boolean;
}

export function PayNowField({ invalid }: Props) {
  const payerMobile = useReceiptStore((s) => s.payerMobile);
  const setPayerMobile = useReceiptStore((s) => s.setPayerMobile);

  return (
    <div>
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
        onChange={(e) => setPayerMobile(e.target.value)}
        aria-invalid={invalid}
        aria-describedby="paynow-status"
        placeholder="9123 4567"
        className="w-full rounded-xl bg-white/10 px-3 py-2 text-base font-medium text-white outline-none placeholder:text-white/30 focus:ring-2 focus:ring-white/30"
      />
    </div>
  );
}
