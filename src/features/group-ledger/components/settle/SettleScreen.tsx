import { useState } from 'react';
import type { Cents, Transfer } from '@features/group-ledger/domain/types';
import type { MyGroup } from '@features/group-ledger/hooks/useGroup';
import { useDataUrl } from '@features/group-ledger/hooks/useDataUrl';
import {
  describeSettleUp,
  transferTitle,
  transferWords,
} from '@features/group-ledger/logic/describe';
import { showToast } from '@features/group-ledger/stores/toastStore';
import { Button } from '@features/group-ledger/components/ui/Button';
import { Icon } from '@features/group-ledger/components/ui/IconButton';
import { MemberAvatar } from '@features/group-ledger/components/ui/MemberAvatar';
import { ScreenHeader, ScreenTitle } from '@features/group-ledger/components/ui/ScreenHeader';
import { buttonClass } from '@features/group-ledger/components/ui/classes';
import { generatePaynowQrDataUrls } from '@features/payments';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { Link } from '@shared/routing';
import { cn } from '@shared/utils/cn';

export function SettleScreen({ group }: { group: MyGroup }) {
  const { ledger, transfers } = group;
  const [copied, setCopied] = useState(false);

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(describeSettleUp(transfers, ledger));
      setCopied(true);
    } catch {
      showToast("Couldn't copy. Your browser blocked it.");
    }
  };

  return (
    <div className="min-h-dvh bg-surface pb-10 font-body text-on-surface">
      <ScreenHeader
        back={{ kind: 'group', groupId: ledger.groupId }}
        backLabel={`Back to ${ledger.name}`}
        title={<ScreenTitle>Settle up</ScreenTitle>}
      />
      <main className="mx-auto max-w-xl px-4 pt-6 motion-safe:animate-slide-in-forward">
        {transfers.length === 0 ? (
          <div className="flex flex-col items-center px-6 pt-16 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container motion-safe:animate-pop-in">
              <Icon name="done_all" className="text-3xl!" />
            </span>
            <h1 className="mt-5 font-headline text-2xl font-bold">Everyone's settled up</h1>
            <p className="mt-1.5 text-on-surface-variant">Nobody owes anybody in {ledger.name}.</p>
            <Link
              to={{ kind: 'group', groupId: ledger.groupId }}
              className={cn(buttonClass('secondary'), 'mt-6')}
            >
              Back to {ledger.name}
            </Link>
          </div>
        ) : (
          <>
            <p className="px-1 text-[0.9375rem] text-on-surface-variant">
              {transfers.length === 1
                ? 'One payment settles'
                : `${transfers.length} payments settle`}{' '}
              everyone. Mark each one paid once the money has moved.
            </p>
            <ul className="mt-4 space-y-3">
              {transfers.map((transfer) => (
                <li key={`${transfer.from}:${transfer.to}`}>
                  <TransferCard group={group} transfer={transfer} />
                </li>
              ))}
            </ul>
            <Button variant="ghost" className="mt-4 w-full" onClick={copySummary}>
              <Icon name={copied ? 'check' : 'content_copy'} className="text-xl!" />
              {copied ? 'Copied for the group chat' : 'Copy summary for the group chat'}
            </Button>
          </>
        )}
      </main>
    </div>
  );
}

function TransferCard({ group, transfer }: { group: MyGroup; transfer: Transfer }) {
  const { ledger, act } = group;
  const [showQr, setShowQr] = useState(false);
  const payee = ledger.members.find((member) => member.id === transfer.to);
  const mobile = ledger.currency === 'SGD' ? (payee?.paynowMobile ?? null) : null;
  const amount = formatCurrencyFromCents(transfer.cents, ledger.currency);
  const words = transferWords(ledger, transfer, 'due');
  const mine = transfer.from === ledger.me || transfer.to === ledger.me;

  const markPaid = () => {
    const paid = act.markPaid(transfer);
    showToast(`${transferTitle(ledger, transfer)} ${amount}`, {
      label: 'Undo',
      run: () => act.removeEntry(paid.entryId, paid.rev),
    });
  };

  return (
    <div className={cn('surface-card p-4', mine && 'border-outline-variant')}>
      <div className="flex items-center gap-3">
        <div className="flex shrink-0 items-center">
          <MemberAvatar ledger={ledger} memberId={transfer.from} />
          <Icon name="arrow_forward" className="mx-1 text-lg! text-outline" />
          <MemberAvatar ledger={ledger} memberId={transfer.to} />
        </div>
        <p className="min-w-0 flex-1 text-sm leading-snug">
          <span className="font-semibold">{words.from}</span> {words.verb}{' '}
          <span className="font-semibold">{words.to}</span>
        </p>
        <p className="shrink-0 font-headline text-xl font-bold tabular-nums">{amount}</p>
      </div>
      <div className="mt-3 flex gap-2">
        {mobile && (
          <Button
            variant="secondary"
            className="flex-1"
            aria-expanded={showQr}
            onClick={() => setShowQr(!showQr)}
          >
            <Icon name="qr_code_2" className="text-xl!" />
            PayNow
          </Button>
        )}
        <Button className="flex-1" onClick={markPaid}>
          <Icon name="check" className="text-xl!" />
          Mark paid
        </Button>
      </div>
      {showQr && mobile && (
        <PaynowQr
          mobile={mobile}
          cents={transfer.cents}
          alt={`PayNow QR to pay ${words.to} ${amount}`}
        />
      )}
      {ledger.currency === 'SGD' && !mobile && transfer.to === ledger.me && (
        <p className="mt-2 text-xs text-on-surface-variant">
          Add your PayNow number under People to show a QR here.
        </p>
      )}
    </div>
  );
}

function PaynowQr({ mobile, cents, alt }: { mobile: string; cents: Cents; alt: string }) {
  const qr = useDataUrl(`${mobile}:${cents}`, async () => {
    const urls = await generatePaynowQrDataUrls(
      [{ id: 'payee', name: '' }],
      { payee: cents },
      mobile,
      180,
    );
    return urls.payee ?? '';
  });
  return (
    <div className="mt-3 flex min-h-[180px] items-center justify-center rounded-xl bg-white p-2 text-center motion-safe:animate-rise-in">
      {qr.status === 'ready' && <img src={qr.url} alt={alt} className="max-h-[180px] max-w-full" />}
      {qr.status === 'loading' && (
        <Icon name="progress_activity" className="text-outline motion-safe:animate-spin" />
      )}
      {qr.status === 'failed' && (
        <p className="text-sm text-on-surface-variant">
          The QR code didn&apos;t load. Pay {mobile} by PayNow instead.
        </p>
      )}
    </div>
  );
}
