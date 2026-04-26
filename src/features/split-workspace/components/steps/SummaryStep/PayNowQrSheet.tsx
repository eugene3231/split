import { formatCurrencyFromCents } from '@shared/logic/core/money';
import type { Person } from '@shared/types';
import { PersonAvatar } from '@features/split-workspace/components/shared/PersonAvatar';
import { buildDownloadFilename } from '@features/sharing/logic/shareSplit';
import { normalizeMobile } from '@features/payments';
import { cn } from '@shared/utils/cn';

interface Props {
  person: Person;
  colorIndex: number;
  totalCents: number;
  currency?: string;
  payerMobile: string;
  qrDataUrl?: string;
  onPayerMobileChange: (mobile: string) => void;
  onClose: () => void;
}

export function PayNowQrSheet({
  person,
  colorIndex,
  totalCents,
  currency,
  payerMobile,
  qrDataUrl,
  onPayerMobileChange,
  onClose,
}: Props) {
  const normalizedMobile = normalizeMobile(payerMobile);
  const canSaveQr = !!normalizedMobile && !!qrDataUrl;

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = buildDownloadFilename('paynow', person.name);
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-4 pb-4 sm:items-center sm:pb-0">
      <button
        type="button"
        aria-label="Close PayNow QR"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paynow-sheet-title"
        className="relative w-full max-w-md rounded-t-[28px] bg-[#FFFCF7] p-6 shadow-2xl sm:rounded-[28px]"
      >
        <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-cream-dim" />

        <div className="mb-5 flex items-center gap-3">
          <PersonAvatar name={person.name} colorIndex={colorIndex} size="xl" />
          <div>
            <p className="text-[11px] font-semibold tracking-[0.24em] text-ink2 uppercase">
              {person.name} owes
            </p>
            <h2
              id="paynow-sheet-title"
              className="font-display text-4xl leading-none font-medium text-ink"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatCurrencyFromCents(totalCents, currency)}
            </h2>
          </div>
        </div>

        <div className="mb-4 rounded-[20px] bg-cream p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <label
              htmlFor="payer-mobile-sheet"
              className="text-[11px] font-semibold tracking-[0.2em] text-ink2 uppercase"
            >
              PayNow number - receiver
            </label>
            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold tracking-wider text-ink2 uppercase">
              Optional
            </span>
          </div>

          <div className="flex gap-3">
            <div
              className="flex w-[74px] shrink-0 flex-col items-center justify-center rounded-[14px] bg-white px-3 py-2 text-center"
              aria-label="Singapore country code +65"
            >
              <span aria-hidden="true" className="text-2xl leading-none">
                🇸🇬
              </span>
              <span className="mt-1 text-sm font-semibold text-ink">+65</span>
            </div>
            <input
              id="payer-mobile-sheet"
              type="tel"
              value={payerMobile}
              onChange={(event) => onPayerMobileChange(event.target.value)}
              placeholder="9123 4567"
              className="min-w-0 flex-1 rounded-[14px] bg-white px-4 py-3 text-base font-medium text-ink outline-none placeholder:text-ink2/60 focus:ring-2 focus:ring-ink/10"
            />
          </div>

          <p className="mt-3 text-xs text-ink2">
            This is the bill payer's number. {person.name} pays this receiver.
          </p>
        </div>

        <div className="mb-4 rounded-[20px] border border-dashed border-cream-dim bg-cream/50 p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-44 w-28 shrink-0 items-center justify-center rounded-[18px] border border-dashed border-cream-dim bg-white p-1.5">
              {canSaveQr ? (
                <img
                  src={qrDataUrl}
                  alt={`PayNow QR for ${person.name} to pay the bill payer`}
                  className="h-full w-full rounded-[12px] object-contain"
                />
              ) : (
                <span className="px-4 text-center text-xs font-medium text-ink2">
                  Enter receiver number
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold tracking-[0.22em] text-ink2 uppercase">
                PayNow
              </p>
              <p className="font-display text-xl leading-tight font-medium text-ink">Scan to pay</p>
              <p className="mt-1 text-xs leading-snug text-ink2">Uses the receiver number above.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[14px] border border-cream-dim bg-white px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-cream"
          >
            Skip QR
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!canSaveQr}
            className={cn(
              'rounded-[14px] px-4 py-3 text-sm font-semibold text-white transition-colors',
              canSaveQr ? 'bg-ink hover:bg-ink/90' : 'cursor-not-allowed bg-ink/25',
            )}
          >
            Save QR
          </button>
        </div>
      </div>
    </div>
  );
}
