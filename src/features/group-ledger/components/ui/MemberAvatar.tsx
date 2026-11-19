import { PersonAvatar } from '@shared/components/PersonAvatar';
import type { Ledger, MemberId } from '@features/group-ledger/domain/types';
import { memberName } from '@features/group-ledger/logic/describe';
import { cn } from '@shared/utils/cn';

interface MemberAvatarProps {
  ledger: Ledger;
  memberId: MemberId;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  xs: 'h-6 w-6 text-[0.6875rem]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
};

export function MemberAvatar({ ledger, memberId, size = 'md', className }: MemberAvatarProps) {
  const id = ledger.aliases.get(memberId) ?? memberId;
  const index = ledger.members.findIndex((member) => member.id === id);
  return (
    <PersonAvatar
      name={memberName(ledger, id)}
      colorIndex={Math.max(index, 0)}
      className={cn(SIZES[size], className)}
    />
  );
}
