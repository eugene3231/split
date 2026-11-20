import { useEffect } from 'react';
import { useJoinGroup } from '@features/group-ledger/hooks/useJoinGroup';
import { Button } from '@features/group-ledger/components/ui/Button';
import { StateScreen } from '@features/group-ledger/components/ui/StateScreen';
import { buttonClass } from '@features/group-ledger/components/ui/classes';
import { Link, navigate } from '@shared/routing';

export function JoinScreen({ code }: { code: string }) {
  const join = useJoinGroup(code);
  const groupId = join.step === 'joined' ? join.groupId : null;

  useEffect(() => {
    if (groupId !== null) navigate({ kind: 'group', groupId }, { replace: true });
  }, [groupId]);

  const home = (
    <Link to={{ kind: 'home' }} className={buttonClass('ghost')}>
      Go to your groups
    </Link>
  );

  switch (join.step) {
    case 'joining':
    case 'joined':
      return <StateScreen icon="progress_activity" title="Joining the group…" busy />;
    case 'bad-link':
      return (
        <StateScreen icon="link_off" title="This link doesn't open a group" action={home}>
          Check you copied all of it. If the group was just made offline, it opens once its maker's
          phone is back online.
        </StateScreen>
      );
    case 'offline':
      return (
        <StateScreen
          icon="cloud_off"
          title="Joining needs a signal"
          action={
            <>
              <Button onClick={join.retry}>Try again</Button>
              {home}
            </>
          }
        >
          Once you've joined, the group works offline too.
        </StateScreen>
      );
    case 'failed':
      return (
        <StateScreen
          icon="error"
          title="Couldn't join just now"
          action={
            <>
              <Button onClick={join.retry}>Try again</Button>
              {home}
            </>
          }
        >
          {join.message}
        </StateScreen>
      );
  }
}
