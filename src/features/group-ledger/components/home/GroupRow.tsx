import type { JoinedGroupEntry } from '@features/group-ledger/sync/joinedGroupsStore';
import { useGroup } from '@features/group-ledger/hooks/useGroup';
import { describeMyBalance } from '@features/group-ledger/logic/describe';
import { DIRECTION_TEXT } from '@features/group-ledger/components/ui/classes';
import { Icon } from '@features/group-ledger/components/ui/IconButton';
import { Link } from '@shared/routing';
import { cn } from '@shared/utils/cn';

/** One group on the home list: its name, where you stand, and whether changes are waiting. */
export function GroupRow({ held }: { held: JoinedGroupEntry }) {
  const group = useGroup(held.groupId);
  const name = group.status === 'ready' ? group.ledger.name : held.name || 'New group';
  let standing = { text: 'Loading…', className: 'text-on-surface-variant' };
  if (group.status === 'ready') {
    const { me } = group.ledger;
    const words = describeMyBalance(
      me === null ? 0 : (group.balances[me] ?? 0),
      group.ledger.currency,
    );
    standing =
      me === null
        ? { text: 'Pick your name to join', className: 'text-on-surface-variant' }
        : { text: words.text, className: DIRECTION_TEXT[words.direction] };
  }
  const waiting = group.status !== 'missing' && group.sync.pending > 0;

  return (
    <Link
      to={{ kind: 'group', groupId: held.groupId }}
      className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-surface-container-low"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-surface-container font-headline text-lg font-bold text-on-surface">
        {name.trim().charAt(0).toUpperCase() || '?'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-on-surface">{name}</span>
        <span className={cn('block truncate text-sm first-letter:uppercase', standing.className)}>
          {standing.text}
        </span>
      </span>
      {waiting && (
        <span title="Changes waiting to sync" className="flex text-outline">
          <Icon name="cloud_upload" className="text-xl" />
          <span className="sr-only">Changes waiting to sync</span>
        </span>
      )}
      <Icon name="chevron_right" className="text-outline" />
    </Link>
  );
}
