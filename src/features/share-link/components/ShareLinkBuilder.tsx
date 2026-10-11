import { useState, type ReactNode } from 'react';
import { normalizeMobile } from '@features/payments';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { useShareableReceipts } from '../hooks/useShareableReceipts';
import { buildSharedReceipt, encodeSharedReceipt } from '../logic/shareLink';
import { ChipGroup } from './ChipGroup';

export function ShareLinkBuilder() {
  const { receipts, people, payerMobile, isSample } = useShareableReceipts();
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [payerName, setPayerName] = useState<string | null>(null);
  const [mobile, setMobile] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const receipt = receipts.find((r) => r.id === receiptId) ?? receipts[0];
  const payer = payerName && people.includes(payerName) ? payerName : people[0];
  const mobileValue = mobile ?? payerMobile;
  const normalizedMobile = normalizeMobile(mobileValue);
  const shared = buildSharedReceipt(receipt, people, {
    name: payer,
    mobile: normalizedMobile ?? '',
  });
  const link = `${window.location.origin}${window.location.pathname}#/prototypes/share?d=${encodeSharedReceipt(shared)}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-6 pb-24">
      <a href="#" className="text-sm font-semibold text-primary">
        ← Back to Split
      </a>
      <h1 className="font-headline mt-4 text-3xl font-extrabold tracking-tight md:text-4xl">
        Let everyone work out their share
      </h1>
      <p className="mt-1 mb-6 text-on-surface-variant">
        Send one link to the group chat. Each friend taps what they had and pays you by PayNow.
      </p>
      {isSample && (
        <p className="mb-6 rounded-xl bg-primary-fixed px-4 py-3 text-sm text-on-primary-fixed">
          Showing a sample receipt. Scan one in the app and come back to share it.
        </p>
      )}

      <div className="space-y-6 rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
        {receipts.length > 1 && (
          <Field label="Receipt">
            <ChipGroup
              name="receipt"
              options={receipts.map((r) => ({ value: r.id, label: r.name }))}
              value={receipt.id}
              onChange={setReceiptId}
            />
          </Field>
        )}
        <Field label="Who paid?">
          <ChipGroup
            name="payer"
            options={people.map((name) => ({ value: name, label: name }))}
            value={payer}
            onChange={setPayerName}
          />
        </Field>
        <Field label={`${payer}'s PayNow mobile`}>
          <input
            type="tel"
            inputMode="tel"
            placeholder="+65 9123 4567"
            value={mobileValue}
            aria-invalid={mobileValue.trim() !== '' && !normalizedMobile}
            onChange={(e) => setMobile(e.target.value)}
            className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 aria-invalid:border-error"
          />
          {!normalizedMobile && (
            <p className="mt-1 text-xs text-on-surface-variant">
              Without a valid SG mobile, friends see their total but no QR.
            </p>
          )}
        </Field>
        <div className="flex items-baseline justify-between border-t border-outline-variant/40 pt-4">
          <p className="text-sm text-on-surface-variant">
            {shared.items.length} items in {shared.name}
          </p>
          <p className="font-headline text-xl font-extrabold text-primary">
            {formatCurrencyFromCents(shared.totalCents, shared.currency)}
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={copyLink}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 font-bold text-on-primary"
        >
          <span className="material-symbols-outlined text-base">{copied ? 'check' : 'link'}</span>
          {copied ? 'Link copied' : 'Copy link for the group chat'}
        </button>
        <a
          href={link}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-outline-variant py-3 font-bold text-on-surface"
        >
          <span className="material-symbols-outlined text-base">visibility</span>
          Open it as a friend would
        </a>
        <p className="text-center text-xs text-on-surface-variant">
          The receipt lives in the link itself. Nothing is uploaded.
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold tracking-widest text-on-surface-variant uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}
