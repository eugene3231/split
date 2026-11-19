import type { ComponentProps } from 'react';
import type { Ledger, MemberId } from '@features/group-ledger/domain/types';
import { MemberAvatar } from '@features/group-ledger/components/ui/MemberAvatar';
import { cn } from '@shared/utils/cn';

interface MemberChipProps extends ComponentProps<'button'> {
  ledger: Ledger;
  memberId: MemberId | null;
  selected: boolean;
}

/** A pill to pick someone with, or with no member, a plain choice such as "Several people". */
export function MemberChip({
  ledger,
  memberId,
  selected,
  className,
  children,
  ...props
}: MemberChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'flex h-10 items-center gap-2 rounded-full border pr-3.5 text-sm font-semibold transition active:scale-95',
        memberId === null ? 'pl-3.5' : 'pl-1.5',
        selected
          ? 'border-primary bg-primary text-on-primary'
          : 'border-surface-container-highest bg-surface-container-lowest text-on-surface hover:border-outline-variant',
        className,
      )}
      {...props}
    >
      {memberId !== null && (
        <MemberAvatar ledger={ledger} memberId={memberId} size="xs" className="h-7 w-7" />
      )}
      {children}
    </button>
  );
}
