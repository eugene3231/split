import type { CurrencyCode } from '@shared/constants';
import type { Change, MemberId } from '@features/group-ledger/domain/types';
import { newMemberId } from '@features/group-ledger/logic/ids';

export interface NewGroup {
  name: string;
  currency: CurrencyCode;
  myName: string;
  friendNames: string[];
}

/**
 * The changes that start a group: it is named, everyone is added, and this phone claims its own
 * name. Blank names and repeats of a name already listed (ignoring case) are left out.
 */
export function newGroupChanges(group: NewGroup): { changes: Change[]; me: MemberId } {
  const myName = group.myName.trim() || 'Me';
  const seen = new Set([myName.toLowerCase()]);
  const friends = group.friendNames
    .map((name) => name.trim())
    .filter((name) => {
      const key = name.toLowerCase();
      if (key === '' || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const members = [myName, ...friends].map((name) => ({
    id: newMemberId(),
    name,
    paynowMobile: null,
    archived: false,
  }));
  const me = members[0].id;
  return {
    me,
    changes: [
      { kind: 'group.created', name: group.name.trim(), currency: group.currency },
      ...members.map((member): Change => ({ kind: 'member.put', member })),
      { kind: 'member.claimed', memberId: me },
    ],
  };
}
