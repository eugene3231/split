import { useState } from 'react';
import { PaynowQr } from '@features/payments';
import { BASE_CURRENCY } from '@shared/constants';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { resolveMyShare, type Claims, type SharedReceipt } from '../logic/shareLink';
import { ChipGroup } from './ChipGroup';
import { ClaimItemRow } from './ClaimItemRow';

interface ClaimShareProps {
  receipt: SharedReceipt;
}

export function ClaimShare({ receipt }: ClaimShareProps) {
  const [myName, setMyName] = useState<string | null>(null);
  const [claims, setClaims] = useState<Claims>({});
  const [showQr, setShowQr] = useState(false);

  const share = resolveMyShare(receipt, claims);
  const format = (cents: number) => formatCurrencyFromCents(cents, receipt.currency);
  const friends = receipt.people.filter((name) => name !== receipt.payerName);
  const canPayNow = receipt.payerMobile !== '' && receipt.currency === BASE_CURRENCY;
  const maxSplit = Math.max(2, receipt.people.length);

  const toggleClaim = (index: number) =>
    setClaims((prev) => {
      const { [index]: claimed, ...rest } = prev;
      return claimed ? rest : { ...prev, [index]: 1 };
    });

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-6 pb-56">
      <p className="text-sm font-semibold text-on-surface-variant">
        {receipt.payerName} paid {format(receipt.totalCents)}
      </p>
      <h1 className="font-headline mt-1 text-3xl font-extrabold tracking-tight">{receipt.name}</h1>
      <p className="mt-1 mb-6 text-on-surface-variant">
        Tap what you had. Service charge and GST are added in proportion.
      </p>

      {friends.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-bold tracking-widest text-on-surface-variant uppercase">
            Who are you?
          </h2>
          <ChipGroup
            name="me"
            options={friends.map((name) => ({ value: name, label: name }))}
            value={myName}
            onChange={setMyName}
          />
        </section>
      )}

      <section>
        <h2 className="mb-2 text-xs font-bold tracking-widest text-on-surface-variant uppercase">
          What did you have?
        </h2>
        <ul className="space-y-2">
          {receipt.items.map((item, index) => (
            <ClaimItemRow
              key={index}
              item={item}
              currency={receipt.currency}
              splitCount={claims[index]}
              maxSplit={maxSplit}
              onToggle={() => toggleClaim(index)}
              onSplitCountChange={(count) => setClaims((prev) => ({ ...prev, [index]: count }))}
            />
          ))}
        </ul>
      </section>

      <div className="fixed inset-x-0 bottom-0 border-t border-outline-variant/40 bg-surface-container-lowest/95 backdrop-blur">
        <div className="mx-auto max-w-xl px-4 py-4">
          {showQr && share.totalCents > 0 && (
            <div className="mb-4">
              <PaynowQr mobile={receipt.payerMobile} amountCents={share.totalCents} />
            </div>
          )}
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-widest text-on-surface-variant uppercase">
                {myName ? `${myName}'s share` : 'Your share'}
              </p>
              <p className="font-headline text-3xl font-extrabold text-primary">
                {format(share.totalCents)}
              </p>
              <p className="text-xs text-on-surface-variant">
                {format(share.itemsCents)} items + {format(share.chargesCents)} charges
              </p>
            </div>
            {canPayNow && (
              <button
                type="button"
                disabled={share.totalCents === 0}
                aria-expanded={showQr}
                onClick={() => setShowQr((v) => !v)}
                className="rounded-full bg-[#7E197E] px-5 py-3 font-bold text-white disabled:opacity-40"
              >
                {showQr ? 'Hide QR' : `Pay ${receipt.payerName}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
