import type { SyncStatus } from '@features/group-ledger/sync/groupSync';
import { Icon } from '@features/group-ledger/components/ui/IconButton';
import { cn } from '@shared/utils/cn';

export function SyncBadge({ sync, className }: { sync: SyncStatus; className?: string }) {
  const stuck = sync.state === 'offline' || sync.state === 'error';
  let label: string | null = null;
  if (sync.state === 'not-a-member') label = "Can't sync: this group's link stopped working";
  else if (sync.outboxStuck) label = `Some changes can't sync · ${sync.pending} kept on this phone`;
  else if (stuck && sync.pending > 0) label = `Saved on this phone · ${sync.pending} waiting`;
  else if (sync.state === 'offline') label = 'Offline';
  else if (sync.state === 'error') label = "Can't reach the server · trying again";
  if (label === null) return null;

  return (
    <p
      role="status"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold motion-safe:animate-fade-in',
        sync.state === 'not-a-member'
          ? 'bg-error-container text-on-error-container'
          : 'bg-warning-container text-on-warning-container',
        className,
      )}
    >
      <Icon
        name={stuck && sync.pending > 0 ? 'cloud_off' : 'sync_problem'}
        className="text-base!"
      />
      {label}
    </p>
  );
}
