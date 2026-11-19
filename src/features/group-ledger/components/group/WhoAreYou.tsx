import { useState } from 'react';
import type { ReadyGroup } from '@features/group-ledger/hooks/useGroup';
import { Button } from '@features/group-ledger/components/ui/Button';
import { MemberAvatar } from '@features/group-ledger/components/ui/MemberAvatar';
import { ScreenHeader } from '@features/group-ledger/components/ui/ScreenHeader';
import { TextField } from '@features/group-ledger/components/ui/TextField';
import { cn } from '@shared/utils/cn';

/** Asked once per group: which member is the person holding this phone. */
export function WhoAreYou({ group }: { group: ReadyGroup }) {
  const { ledger, act } = group;
  const [newName, setNewName] = useState<string | null>(null);
  const live = ledger.members.filter((member) => !member.archived);
  const ordered = [
    ...live.filter((member) => !ledger.claimed.has(member.id)),
    ...live.filter((member) => ledger.claimed.has(member.id)),
  ];

  const joinAsNew = () => {
    if (!newName?.trim()) return;
    act.claim(act.addMember(newName));
  };

  return (
    <div className="min-h-dvh bg-surface font-body text-on-surface">
      <ScreenHeader back={{ kind: 'home' }} backLabel="Home" title={null} />
      <main className="mx-auto max-w-xl px-5 pt-8 pb-12 motion-safe:animate-fade-in">
        <h1 className="font-headline text-[1.75rem] leading-tight font-bold tracking-tight">
          Who are you in {ledger.name}?
        </h1>
        <p className="mt-1.5 text-[0.9375rem] text-on-surface-variant">
          Pick your name so Split knows which amounts are yours. You only do this once.
        </p>

        <ul className="mt-6 grid grid-cols-2 gap-3">
          {ordered.map((member) => {
            const taken = ledger.claimed.has(member.id);
            return (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() => act.claim(member.id)}
                  className={cn(
                    'flex h-16 w-full items-center gap-3 rounded-2xl border px-3 text-left transition active:scale-[0.98] motion-safe:animate-person-in',
                    taken
                      ? 'border-surface-container-highest bg-surface-container-low text-on-surface-variant'
                      : 'border-surface-container-highest bg-surface-container-lowest hover:border-outline-variant',
                  )}
                >
                  <MemberAvatar
                    ledger={ledger}
                    memberId={member.id}
                    className={cn(taken && 'opacity-60')}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{member.name}</span>
                    {taken && <span className="block text-xs">On another phone</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {newName === null ? (
          <Button variant="ghost" className="mt-4 w-full" onClick={() => setNewName('')}>
            I'm not on the list
          </Button>
        ) : (
          <form
            className="mt-6 surface-card p-4 motion-safe:animate-rise-in"
            onSubmit={(event) => {
              event.preventDefault();
              joinAsNew();
            }}
          >
            <TextField
              label="Your name"
              autoFocus
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="e.g. Sam"
              autoComplete="given-name"
            />
            <Button type="submit" size="lg" className="mt-3 w-full" disabled={!newName.trim()}>
              Join as {newName.trim() || '…'}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
