import type { ReactNode } from 'react';
import type { GroupId } from '@features/group-ledger/domain/types';
import { useGroup, type MyGroup } from '@features/group-ledger/hooks/useGroup';
import { StateScreen } from '@features/group-ledger/components/ui/StateScreen';
import { buttonClass } from '@features/group-ledger/components/ui/classes';
import { Link } from '@shared/routing';
import { gateScreen } from './gateScreen';
import { WhoAreYou } from './WhoAreYou';

interface GroupGateProps {
  groupId: GroupId;
  children: (group: MyGroup) => ReactNode;
}

export function GroupGate({ groupId, children }: GroupGateProps) {
  const screen = gateScreen(useGroup(groupId));
  const home = (
    <Link to={{ kind: 'home' }} className={buttonClass('secondary')}>
      Back to your groups
    </Link>
  );

  switch (screen.kind) {
    case 'not-on-phone':
      return (
        <StateScreen icon="link_off" title="This group isn't on this phone" action={home}>
          Open the invite link a friend sent you to join it.
        </StateScreen>
      );
    case 'link-stopped':
      return (
        <StateScreen icon="block" title="This link stopped working" action={home}>
          Ask someone in the group to send you the invite link again.
        </StateScreen>
      );
    case 'waiting-for-signal':
      return (
        <StateScreen icon="cloud_off" title="Waiting for a signal">
          The group opens here once this phone is online. After that it works offline too.
        </StateScreen>
      );
    case 'opening':
      return <StateScreen icon="progress_activity" title="Opening the group…" busy />;
    case 'who-are-you':
      return <WhoAreYou group={screen.group} />;
    case 'in-group':
      return children(screen.group);
  }
}
