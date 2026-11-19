import type { Activity } from '@features/group-ledger/domain/types';
import type { ReadyGroup } from '@features/group-ledger/hooks/useGroup';
import { timeAgo } from '@features/group-ledger/logic/dates';
import { describeActivity, describeEntry } from '@features/group-ledger/logic/describe';
import { showToast } from '@features/group-ledger/stores/toastStore';
import { Button } from '@features/group-ledger/components/ui/Button';
import { Icon } from '@features/group-ledger/components/ui/IconButton';
import { MemberAvatar } from '@features/group-ledger/components/ui/MemberAvatar';
import { ScreenHeader, ScreenTitle } from '@features/group-ledger/components/ui/ScreenHeader';
import { cn } from '@shared/utils/cn';

export function ActivityScreen({ group }: { group: ReadyGroup }) {
  const { ledger } = group;
  const now = new Date();
  return (
    <div className="min-h-dvh bg-surface pb-10 font-body text-on-surface">
      <ScreenHeader
        back={{ kind: 'group', groupId: ledger.groupId }}
        backLabel={`Back to ${ledger.name}`}
        title={<ScreenTitle>Activity</ScreenTitle>}
      />
      <main className="mx-auto max-w-xl px-4 pt-5 motion-safe:animate-slide-in-forward">
        <ul className="divide-y divide-surface-container-highest surface-card">
          {ledger.activity.map((activity) => (
            <li key={activity.opId}>
              <ActivityRow group={group} activity={activity} now={now} />
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

function ActivityRow({
  group,
  activity,
  now,
}: {
  group: ReadyGroup;
  activity: Activity;
  now: Date;
}) {
  const { ledger, act } = group;
  const { replaced, undo } = activity;
  const restoreOther = () => {
    if (replaced === null) return;
    const head = ledger.entries.find((posted) => posted.entry.id === replaced.id);
    act.editEntry(replaced, head?.rev ?? activity.opId);
    showToast(`Restored ${describeEntry(replaced, ledger)}`);
  };

  return (
    <div className={cn('flex gap-3 px-4 py-3', replaced && 'bg-warning-container/70')}>
      {activity.by === null ? (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
          <Icon name="person" className="text-lg!" />
        </span>
      ) : (
        <MemberAvatar ledger={ledger} memberId={activity.by} size="sm" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-on-surface">{describeActivity(activity, ledger)}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-on-surface-variant">
          {timeAgo(activity.at, now)}
          {activity.pending && (
            <span className="inline-flex items-center gap-0.5">
              <Icon name="cloud_upload" className="text-sm!" />
              On this phone only
            </span>
          )}
        </p>
        {replaced && (
          <div className="mt-2 rounded-xl bg-surface-container-lowest/80 p-3 text-sm text-on-warning-container">
            <p>Replaced a change made at the same time: {describeEntry(replaced, ledger)}.</p>
            <Button variant="secondary" className="mt-2 h-9 w-full" onClick={restoreOther}>
              Restore the other version
            </Button>
          </div>
        )}
      </div>
      {undo && (
        <Button
          variant="ghost"
          className="h-9 shrink-0 px-3"
          aria-label={`Undo: ${describeActivity(activity, ledger)}`}
          onClick={() => {
            act.undo(activity);
            showToast('Undone');
          }}
        >
          Undo
        </Button>
      )}
    </div>
  );
}
