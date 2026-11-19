import { useState } from 'react';
import QRCode from 'qrcode';
import type { MyGroup } from '@features/group-ledger/hooks/useGroup';
import { useDataUrl } from '@features/group-ledger/hooks/useDataUrl';
import { Button } from '@features/group-ledger/components/ui/Button';
import { Icon } from '@features/group-ledger/components/ui/IconButton';
import { Sheet } from '@features/group-ledger/components/ui/Sheet';
import { href } from '@shared/routing';

interface InviteSheetProps {
  group: MyGroup;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteSheet({ group, open, onOpenChange }: InviteSheetProps) {
  const link = `${window.location.origin}${href({ kind: 'join', code: group.inviteCode })}`;
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator.share === 'function';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setCopied(false);
        onOpenChange(next);
      }}
      title="Invite friends"
      description={`Anyone with this link can join ${group.ledger.name}. No account needed.`}
    >
      <InviteQr link={link} groupName={group.ledger.name} />
      <p className="mt-4 rounded-xl bg-surface-container px-4 py-3 font-mono text-xs break-all text-on-surface-variant select-all">
        {link}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={copy}>
          <Icon name={copied ? 'check' : 'content_copy'} className="text-xl!" />
          {copied ? 'Copied' : 'Copy link'}
        </Button>
        {canShare ? (
          <Button
            onClick={() =>
              navigator
                .share({
                  title: group.ledger.name,
                  text: `Join ${group.ledger.name} on Split`,
                  url: link,
                })
                .catch(() => {})
            }
          >
            <Icon name="ios_share" className="text-xl!" />
            Share
          </Button>
        ) : (
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        )}
      </div>
    </Sheet>
  );
}

function InviteQr({ link, groupName }: { link: string; groupName: string }) {
  const qr = useDataUrl(link, () =>
    QRCode.toDataURL(link, { margin: 1, width: 440, color: { dark: '#1b2130' } }),
  );
  return (
    <div className="flex justify-center">
      <div className="flex size-56 items-center justify-center rounded-2xl border border-surface-container-highest bg-white p-3 text-center">
        {qr.status === 'ready' && (
          <img src={qr.url} alt={`QR code to join ${groupName}`} className="size-full" />
        )}
        {qr.status === 'loading' && <Icon name="qr_code_2" className="text-5xl! text-outline" />}
        {qr.status === 'failed' && (
          <p className="text-sm text-on-surface-variant">
            The QR code didn&apos;t load. Send the link below instead.
          </p>
        )}
      </div>
    </div>
  );
}
