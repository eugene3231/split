import { useState } from 'react';
import type { Member, MemberId } from '@features/group-ledger/domain/types';
import type { ReadyGroup } from '@features/group-ledger/hooks/useGroup';
import { likelyDuplicates } from '@features/group-ledger/logic/duplicates';
import { memberName } from '@features/group-ledger/logic/describe';
import { Button } from '@features/group-ledger/components/ui/Button';
import { Icon } from '@features/group-ledger/components/ui/IconButton';
import { MemberAvatar } from '@features/group-ledger/components/ui/MemberAvatar';
import { Sheet } from '@features/group-ledger/components/ui/Sheet';
import { TextField } from '@features/group-ledger/components/ui/TextField';
import { normalizeMobile } from '@features/payments';
import { cn } from '@shared/utils/cn';

interface MembersSheetProps {
  group: ReadyGroup;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MembersSheet({ group, open, onOpenChange }: MembersSheetProps) {
  const { ledger, act } = group;
  const [friend, setFriend] = useState('');
  const [editing, setEditing] = useState<MemberId | null>(null);

  const addFriend = () => {
    if (!friend.trim()) return;
    act.addMember(friend);
    setFriend('');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="People">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          addFriend();
        }}
        className="flex items-center gap-2 field p-1.5 pl-4"
      >
        <input
          aria-label="Friend's name"
          value={friend}
          onChange={(event) => setFriend(event.target.value)}
          placeholder="Add a friend by name"
          className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-outline"
        />
        <button
          type="submit"
          disabled={!friend.trim()}
          className="flex h-10 items-center gap-1 rounded-lg bg-primary px-3.5 text-sm font-semibold text-on-primary transition active:scale-95 disabled:opacity-45"
        >
          <Icon name="add" className="text-xl" />
          Add
        </button>
      </form>

      <DuplicateHints group={group} />

      <ul className="mt-4 divide-y divide-surface-container-highest">
        {ledger.members.map((member) =>
          editing === member.id ? (
            <li key={member.id} className="py-3">
              <MemberEditor
                member={member}
                paynow={ledger.currency === 'SGD'}
                onSave={(next) => {
                  act.updateMember(next);
                  setEditing(null);
                }}
                onCancel={() => setEditing(null)}
              />
            </li>
          ) : (
            <li key={member.id}>
              <button
                type="button"
                onClick={() => setEditing(member.id)}
                className="flex w-full items-center gap-3 py-3 text-left"
              >
                <MemberAvatar
                  ledger={ledger}
                  memberId={member.id}
                  className={cn(member.archived && 'opacity-50')}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block truncate font-semibold',
                      member.archived && 'text-on-surface-variant',
                    )}
                  >
                    {member.name}
                    {member.id === ledger.me && (
                      <span className="font-normal text-on-surface-variant"> (you)</span>
                    )}
                  </span>
                  <span className="block text-xs text-on-surface-variant">
                    {[
                      member.archived
                        ? 'Archived'
                        : ledger.claimed.has(member.id)
                          ? 'Joined'
                          : 'Not joined yet',
                      member.paynowMobile && `PayNow ${member.paynowMobile}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <Icon name="edit" className="text-lg text-outline" />
              </button>
            </li>
          ),
        )}
      </ul>
    </Sheet>
  );
}

function DuplicateHints({ group }: { group: ReadyGroup }) {
  const { ledger, act } = group;
  const pairs = likelyDuplicates(ledger.members);
  if (pairs.length === 0) return null;
  return (
    <div className="mt-4 space-y-2">
      {pairs.map(([first, second]) => {
        // Keep the one somebody has claimed, so their phone still knows who they are.
        const [from, into] = ledger.claimed.has(second) ? [first, second] : [second, first];
        return (
          <div
            key={`${first}:${second}`}
            className="flex items-center gap-3 rounded-2xl bg-warning-container p-3 text-sm text-on-warning-container"
          >
            <Icon name="group" className="text-xl" />
            <p className="min-w-0 flex-1">
              Two people called <strong>{memberName(ledger, first)}</strong>. Same person?
            </p>
            <Button
              variant="secondary"
              className="h-9"
              onClick={() => act.mergeMembers(from, into)}
            >
              Merge
            </Button>
          </div>
        );
      })}
    </div>
  );
}

interface MemberEditorProps {
  member: Member;
  paynow: boolean;
  onSave: (member: Member) => void;
  onCancel: () => void;
}

function MemberEditor({ member, paynow, onSave, onCancel }: MemberEditorProps) {
  const [name, setName] = useState(member.name);
  const [mobile, setMobile] = useState(member.paynowMobile ?? '');
  const normalised = mobile.trim() === '' ? null : normalizeMobile(mobile);
  const mobileInvalid = mobile.trim() !== '' && normalised === null;

  return (
    <form
      className="space-y-3 motion-safe:animate-rise-in"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim() || mobileInvalid) return;
        onSave({ ...member, name: name.trim(), paynowMobile: normalised });
      }}
    >
      <TextField
        label="Name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        autoFocus
      />
      {paynow && (
        <TextField
          label="PayNow mobile"
          inputMode="tel"
          value={mobile}
          onChange={(event) => setMobile(event.target.value)}
          placeholder="9123 4567"
          hint={
            mobileInvalid
              ? 'That is not a Singapore mobile number.'
              : 'Shows a QR when people pay them.'
          }
        />
      )}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          onClick={() => onSave({ ...member, archived: !member.archived })}
          className="mr-auto px-3"
        >
          <Icon name={member.archived ? 'unarchive' : 'archive'} className="text-xl" />
          {member.archived ? 'Bring back' : 'Archive'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim() || mobileInvalid}>
          Save
        </Button>
      </div>
    </form>
  );
}
