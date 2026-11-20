import { useState } from 'react';
import { z } from 'zod';
import { CURRENCY_CODES, type CurrencyCode } from '@shared/constants';
import { PersonAvatar } from '@shared/components/PersonAvatar';
import { uniqueNames } from '@features/group-ledger/logic/newGroup';
import { createGroup } from '@features/group-ledger/sync/createGroup';
import { Button } from '@features/group-ledger/components/ui/Button';
import { Icon } from '@features/group-ledger/components/ui/IconButton';
import { PillSelect } from '@features/group-ledger/components/ui/PillSelect';
import { Sheet } from '@features/group-ledger/components/ui/Sheet';
import { TextField } from '@features/group-ledger/components/ui/TextField';
import { OPEN_INVITE_STATE } from '@features/group-ledger/components/group/openInvite';
import { useSavedGroupsStore } from '@features/split-workspace';
import { jsonStorage } from '@shared/logic/jsonStorage';
import { navigate } from '@shared/routing';

interface NewGroupSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CURRENCY_OPTIONS = CURRENCY_CODES.map((code) => ({ value: code, label: code }));
const myNameStorage = jsonStorage('localStorage', 'split:my-name', z.string());

export function NewGroupSheet({ open, onOpenChange }: NewGroupSheetProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="New group"
      description="For a trip, a flat, or a regular lunch. Friends join with a link."
    >
      {open && <NewGroupForm />}
    </Sheet>
  );
}

function NewGroupForm() {
  const savedGroups = useSavedGroupsStore((state) => state.groups);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('SGD');
  const [myName, setMyName] = useState(() => myNameStorage.load() ?? '');
  const [friendInput, setFriendInput] = useState('');
  const [friends, setFriends] = useState<string[]>([]);
  const ready = name.trim() !== '' && myName.trim() !== '';

  const addFriends = (names: string[]) =>
    setFriends([...friends, ...uniqueNames(names, [myName, ...friends])]);

  const create = () => {
    if (!ready) return;
    myNameStorage.save(myName.trim());
    const friendNames = [...friends, ...friendInput.split(',')];
    const groupId = createGroup({ name, currency, myName, friendNames });
    navigate({ kind: 'group', groupId }, { state: OPEN_INVITE_STATE });
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        create();
      }}
    >
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <TextField
          label="Group name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Japan 2026"
          autoFocus
          maxLength={60}
        />
        <label className="block">
          <span className="mb-1.5 block section-label">Currency</span>
          <PillSelect
            label="Currency"
            value={currency}
            options={CURRENCY_OPTIONS}
            onChange={setCurrency}
            className="flex h-12 items-center gap-1 field pr-2 pl-4 font-semibold"
          >
            {currency}
            <Icon name="expand_more" className="text-lg! text-on-surface-variant" />
          </PillSelect>
        </label>
      </div>

      <TextField
        label="Your name"
        value={myName}
        onChange={(event) => setMyName(event.target.value)}
        placeholder="What friends call you"
        autoComplete="given-name"
      />

      <div>
        <label htmlFor="new-group-friend" className="mb-1.5 block section-label">
          Friends
        </label>
        <div className="flex flex-wrap items-center gap-1.5 field p-1.5">
          {friends.map((friend, index) => (
            <button
              key={friend}
              type="button"
              aria-label={`Remove ${friend}`}
              onClick={() => setFriends(friends.filter((other) => other !== friend))}
              className="flex h-9 items-center gap-1.5 rounded-full bg-surface-container-lowest pr-2.5 pl-1 text-sm font-semibold shadow-[0_1px_2px_rgba(23,28,39,0.08)] motion-safe:animate-person-in"
            >
              <PersonAvatar name={friend} colorIndex={index + 1} className="h-7 w-7 text-xs" />
              {friend}
              <Icon name="close" className="text-sm! text-on-surface-variant" />
            </button>
          ))}
          <input
            id="new-group-friend"
            value={friendInput}
            onChange={(event) => setFriendInput(event.target.value)}
            onKeyDown={(event) => {
              if ((event.key === 'Enter' || event.key === ',') && friendInput.trim()) {
                event.preventDefault();
                addFriends(friendInput.split(','));
                setFriendInput('');
              } else if (event.key === 'Backspace' && friendInput === '' && friends.length > 0) {
                setFriends(friends.slice(0, -1));
              }
            }}
            enterKeyHint="next"
            placeholder={friends.length === 0 ? 'Type a name, then Enter' : 'Add another'}
            className="h-9 min-w-32 flex-1 bg-transparent px-2.5 text-base outline-none placeholder:text-outline"
          />
        </div>
        <p className="mt-1.5 px-1 text-xs text-on-surface-variant">
          Add friends now or later. They pick their name when they open the link.
        </p>
      </div>

      {savedGroups.length > 0 && (
        <div>
          <p className="mb-1.5 section-label">From your saved groups</p>
          <div className="flex flex-wrap gap-2">
            {savedGroups.map((saved) => (
              <button
                key={saved.id}
                type="button"
                onClick={() => addFriends(saved.names)}
                className="flex h-9 items-center gap-1.5 rounded-full border border-surface-container-highest bg-surface-container-lowest px-3 text-sm font-semibold transition hover:border-outline-variant active:scale-95"
              >
                <Icon name="group_add" className="text-lg! text-on-surface-variant" />
                {saved.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={!ready}>
        Create group
      </Button>
    </form>
  );
}
