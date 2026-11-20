import type { CurrencyCode } from '@shared/constants';
import type { Change, Member } from '@features/group-ledger/domain/types';
import { newMemberId } from '@features/group-ledger/logic/ids';

export interface NewGroup {
  name: string;
  currency: CurrencyCode;
  myName: string;
  friendNames: string[];
}

/** `names` trimmed, without blanks and without repeats of each other or of `taken`, ignoring case. */
export function uniqueNames(names: string[], taken: string[] = []): string[] {
  const seen = new Set(taken.map((name) => name.trim().toLowerCase()));
  return names
    .map((name) => name.trim())
    .filter((name) => {
      const key = name.toLowerCase();
      if (key === '' || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * The changes that start a group. The creator comes first: the group is named, this phone's
 * member is added and claimed. Then each friend is added once.
 */
export function newGroupChanges(group: NewGroup): Change[] {
  const myName = group.myName.trim();
  const me = newMember(myName);
  const creator: Change[] = [
    { kind: 'group.created', name: group.name.trim(), currency: group.currency },
    { kind: 'member.put', member: me },
    { kind: 'member.claimed', memberId: me.id },
  ];
  const friends = uniqueNames(group.friendNames, [myName]).map((name): Change => ({
    kind: 'member.put',
    member: newMember(name),
  }));
  return [...creator, ...friends];
}

function newMember(name: string): Member {
  return { id: newMemberId(), name, paynowMobile: null, archived: false };
}
