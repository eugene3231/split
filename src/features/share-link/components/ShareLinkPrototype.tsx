import { decodeSharedReceipt } from '../logic/shareLink';
import { ClaimShare } from './ClaimShare';
import { ShareLinkBuilder } from './ShareLinkBuilder';

interface ShareLinkPrototypeProps {
  encodedReceipt: string | null;
}

export function ShareLinkPrototype({ encodedReceipt }: ShareLinkPrototypeProps) {
  if (!encodedReceipt) {
    return <ShareLinkBuilder />;
  }

  const receipt = decodeSharedReceipt(encodedReceipt);
  if (!receipt) {
    return (
      <div className="mx-auto max-w-md px-4 pt-16 text-center">
        <span className="material-symbols-outlined text-5xl text-error">link_off</span>
        <h1 className="font-headline mt-3 text-2xl font-extrabold">This link is broken</h1>
        <p className="mt-2 text-on-surface-variant">
          It may have been cut off when it was pasted. Ask whoever paid to send it again.
        </p>
      </div>
    );
  }
  return <ClaimShare key={encodedReceipt} receipt={receipt} />;
}
