import { useState } from 'react';
import { useJoinedGroupsStore } from '@features/group-ledger/sync/joinedGroupsStore';
import { useAccountStore } from '@features/group-ledger/sync/accountStore';
import { Button } from '@features/group-ledger/components/ui/Button';
import { Icon, IconButton } from '@features/group-ledger/components/ui/IconButton';
import { buttonClass } from '@features/group-ledger/components/ui/classes';
import { useQuickSplitStarted } from '@features/split-workspace';
import { Link } from '@shared/routing';
import { AccountSheet } from './AccountSheet';
import { GroupRow } from './GroupRow';
import { NewGroupSheet } from './NewGroupSheet';

type OpenSheet = 'new-group' | 'account' | null;

export function HomeScreen() {
  const groups = useJoinedGroupsStore((state) => state.groups);
  const linked = useAccountStore((state) => state.session?.account.kind === 'linked');
  const quickSplitStarted = useQuickSplitStarted();
  const [sheet, setSheet] = useState<OpenSheet>(null);
  const sorted = groups.toSorted((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));

  return (
    <div className="min-h-dvh bg-surface pb-12 font-body text-on-surface">
      <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex h-(--app-bar-height) max-w-xl items-center justify-between border-b border-surface-container-highest pr-2 pl-5 sm:pr-4">
          <span className="font-headline text-2xl font-bold tracking-tight text-primary">
            Split
          </span>
          <IconButton
            label={linked ? 'Your account' : 'Keep your groups'}
            icon={linked ? 'account_circle' : 'cloud_sync'}
            onClick={() => setSheet('account')}
          />
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pt-6 motion-safe:animate-fade-in">
        <section className="flex items-center gap-4 surface-card p-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-primary">
            <Icon name="receipt_long" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Quick split</h2>
            <p className="text-sm text-on-surface-variant">
              {quickSplitStarted
                ? 'Pick up the bill you started.'
                : 'One bill, right now. No group needed.'}
            </p>
          </div>
          <Link
            to={{ kind: 'split' }}
            className={buttonClass(quickSplitStarted ? 'primary' : 'secondary')}
          >
            {quickSplitStarted ? 'Continue' : 'Start'}
          </Link>
        </section>

        <div className="mt-8 mb-3 flex items-center justify-between px-1">
          <h2 className="font-headline text-lg font-bold">Your groups</h2>
          {sorted.length > 0 && (
            <Button variant="ghost" className="-mr-2" onClick={() => setSheet('new-group')}>
              <Icon name="add" className="text-xl" />
              New group
            </Button>
          )}
        </div>

        {sorted.length === 0 ? (
          <div className="flex flex-col items-center rounded-card border border-dashed border-outline-variant px-6 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
              <Icon name="groups" />
            </span>
            <p className="mt-3 max-w-xs font-semibold">Keep a running tab with friends.</p>
            <p className="mt-1 max-w-xs text-sm text-on-surface-variant">
              Everyone adds what they paid from their own phone, and Split works out who owes whom.
            </p>
            <Button size="lg" className="mt-5" onClick={() => setSheet('new-group')}>
              <Icon name="add" className="text-xl" />
              New group
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-surface-container-highest overflow-hidden surface-card">
            {sorted.map((held) => (
              <li key={held.groupId}>
                <GroupRow held={held} />
              </li>
            ))}
          </ul>
        )}
      </main>

      <NewGroupSheet
        open={sheet === 'new-group'}
        onOpenChange={(open) => setSheet(open ? 'new-group' : null)}
      />
      <AccountSheet
        open={sheet === 'account'}
        onOpenChange={(open) => setSheet(open ? 'account' : null)}
      />
    </div>
  );
}
