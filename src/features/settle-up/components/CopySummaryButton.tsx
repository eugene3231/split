import { useState } from 'react';
import type { Person } from '@shared/types';
import { formatSettleUpText, type Transfer } from '../logic/settleUp';

interface CopySummaryButtonProps {
  people: Person[];
  transfers: Transfer[];
}

export function CopySummaryButton({ people, transfers }: CopySummaryButtonProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(formatSettleUpText(people, transfers));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-bold text-on-primary"
    >
      <span className="material-symbols-outlined text-base">
        {copied ? 'check' : 'content_copy'}
      </span>
      {copied ? 'Copied' : 'Copy for group chat'}
    </button>
  );
}
