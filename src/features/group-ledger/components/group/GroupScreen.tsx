import { useEffect, useState } from 'react';
import type { MyGroup } from '@features/group-ledger/hooks/useGroup';
import { useJoinedGroupsStore } from '@features/group-ledger/sync/joinedGroupsStore';
import { describeBalance, describeMyBalance } from '@features/group-ledger/logic/describe';
import { memberIdsOf } from '@features/group-ledger/logic/ids';
import { DIRECTION_TEXT, buttonClass } from '@features/group-ledger/components/ui/classes';
import { Button } from '@features/group-ledger/components/ui/Button';
import { Icon, IconButton, IconLink } from '@features/group-ledger/components/ui/IconButton';
import { MemberAvatar } from '@features/group-ledger/components/ui/MemberAvatar';
import { ScreenHeader, ScreenTitle } from '@features/group-ledger/components/ui/ScreenHeader';
import { Link } from '@shared/routing';
import { cn } from '@shared/utils/cn';
import { AddSheet } from './AddSheet';
import { EntryList } from './EntryList';
import { InviteSheet } from './InviteSheet';
import { MembersSheet } from './MembersSheet';
import { OPEN_INVITE_STATE } from './openInvite';
import { SyncBadge } from './SyncBadge';

type OpenSheet = 'invite' | 'members' | 'add' | null;

export function GroupScreen({ group }: { group: MyGroup }) {
  const { ledger, balances, transfers, sync } = group;
  const [sheet, setSheet] = useState<OpenSheet>(() =>
    window.history.state === OPEN_INVITE_STATE ? 'invite' : null,
  );
  const openSheet = (next: OpenSheet) => {
    if (window.history.state === OPEN_INVITE_STATE) window.history.replaceState(null, '');
    setSheet(next);
  };
  const me = ledger.me;
  useEffect(() => useJoinedGroupsStore.getState().markOpened(ledger.groupId), [ledger.groupId]);
  const mine = describeMyBalance(balances[me] ?? 0, ledger.currency);
  const live = ledger.members.filter((member) => !member.archived);
  const others = memberIdsOf(balances).filter((id) => id !== me);

  return (
    <div className="min-h-dvh bg-surface pb-28 font-body text-on-surface">
      <ScreenHeader
        back={{ kind: 'home' }}
        backLabel="Your groups"
        title={<ScreenTitle>{ledger.name}</ScreenTitle>}
      >
        <IconLink
          to={{ kind: 'activity', groupId: ledger.groupId }}
          label="Activity"
          icon="history"
        />
        <button
          type="button"
          aria-label="People"
          onClick={() => openSheet('members')}
          className="flex h-10 items-center rounded-xl px-1.5 transition hover:bg-surface-container active:scale-95"
        >
          {live.slice(0, 3).map((member, index) => (
            <MemberAvatar
              key={member.id}
              ledger={ledger}
              memberId={member.id}
              size="sm"
              className={cn('ring-2 ring-surface', index > 0 && '-ml-2.5')}
            />
          ))}
          {live.length > 3 && (
            <span className="-ml-2.5 flex size-8 items-center justify-center rounded-full bg-surface-container-highest text-xs font-bold text-on-surface-variant ring-2 ring-surface">
              +{live.length - 3}
            </span>
          )}
        </button>
        <IconButton label="Invite friends" icon="person_add" onClick={() => openSheet('invite')} />
      </ScreenHeader>

      <main className="mx-auto max-w-xl px-4 pt-5 motion-safe:animate-fade-in">
        <SyncBadge sync={sync} className="mb-4" />

        {ledger.entries.length > 0 && (
          <>
            <section aria-label="Your balance" className="px-1">
              <p className="section-label">In {ledger.name}</p>
              <p
                className={cn(
                  'mt-1 font-headline text-[2rem] leading-tight font-bold tracking-tight first-letter:uppercase',
                  mine.direction === 'even' ? 'text-on-surface' : DIRECTION_TEXT[mine.direction],
                )}
              >
                {mine.text}
              </p>
            </section>

            {others.length > 0 && (
              <ul
                aria-label="Everyone's balances"
                className="mt-4 divide-y divide-surface-container-highest surface-card"
              >
                {others.map((id) => {
                  const words = describeBalance(balances[id], ledger.currency);
                  const member = ledger.members.find((candidate) => candidate.id === id);
                  return (
                    <li key={id} className="flex items-center gap-3 px-4 py-2.5">
                      <MemberAvatar ledger={ledger} memberId={id} size="sm" />
                      <span className="min-w-0 flex-1 truncate font-medium">{member?.name}</span>
                      <span
                        className={cn(
                          'shrink-0 text-sm font-semibold tabular-nums',
                          DIRECTION_TEXT[words.direction],
                        )}
                      >
                        {words.text}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            {transfers.length > 0 && (
              <Link
                to={{ kind: 'settle', groupId: ledger.groupId }}
                className={cn(buttonClass('secondary', 'lg'), 'mt-3 w-full')}
              >
                <Icon name="handshake" className="text-xl!" />
                Settle up
              </Link>
            )}
          </>
        )}

        <h2
          className={cn(
            'mb-3 px-1 font-headline text-lg font-bold',
            ledger.entries.length > 0 && 'mt-8',
          )}
        >
          Expenses
        </h2>
        {ledger.entries.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-card border border-dashed border-outline-variant px-6 py-10 text-center">
            <Icon name="receipt_long" className="mb-1 text-2xl! text-outline" />
            <p className="text-sm font-semibold">No expenses yet</p>
            <p className="text-sm text-on-surface-variant">
              Add what you paid, and Split keeps track of who owes whom.
            </p>
            {live.length - ledger.claimed.size > 0 && (
              <Button variant="secondary" className="mt-4" onClick={() => openSheet('invite')}>
                <Icon name="person_add" className="text-xl!" />
                Invite friends
              </Button>
            )}
          </div>
        ) : (
          <EntryList group={group} />
        )}
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-xl justify-end px-4">
          <button
            type="button"
            onClick={() => openSheet('add')}
            className="pointer-events-auto flex h-14 items-center gap-2 rounded-2xl bg-primary pr-6 pl-5 font-semibold text-on-primary shadow-[0_12px_28px_-10px_rgba(23,28,39,0.55)] transition active:scale-95 motion-safe:animate-pop-in"
          >
            <Icon name="add" />
            Add expense
          </button>
        </div>
      </div>

      <AddSheet
        groupId={ledger.groupId}
        open={sheet === 'add'}
        onOpenChange={(open) => openSheet(open ? 'add' : null)}
      />
      <InviteSheet
        group={group}
        open={sheet === 'invite'}
        onOpenChange={(open) => openSheet(open ? 'invite' : null)}
      />
      <MembersSheet
        group={group}
        open={sheet === 'members'}
        onOpenChange={(open) => openSheet(open ? 'members' : null)}
      />
    </div>
  );
}
