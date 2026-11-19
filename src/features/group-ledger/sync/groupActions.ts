import type {
  Activity,
  Change,
  Entry,
  EntryId,
  Member,
  MemberId,
  OpId,
  Transfer,
} from '@features/group-ledger/domain/types';
import { newEntryId, newMemberId, todayLocalDate } from '@features/group-ledger/logic/ids';

/** Everything a screen can do to a group. Each one is a change stored on this phone first. */
export interface GroupActions {
  addExpense: (entry: Entry) => void;
  /** `base` is the revision on screen when the edit began. Also how a replaced version comes back. */
  editEntry: (entry: Entry, base: OpId) => void;
  /** Returns the op that removed it, the `base` for putting it back. */
  removeEntry: (entryId: EntryId, base: OpId) => OpId;
  undo: (activity: Activity) => void;
  markPaid: (transfer: Transfer) => void;
  addMember: (name: string) => MemberId;
  updateMember: (member: Member) => void;
  mergeMembers: (from: MemberId, into: MemberId) => void;
  claim: (memberId: MemberId | null) => void;
  rename: (name: string) => void;
}

export function groupActions(submit: (change: Change) => OpId): GroupActions {
  return {
    addExpense: (entry) => submit({ kind: 'entry.put', entry, base: null }),
    editEntry: (entry, base) => submit({ kind: 'entry.put', entry, base }),
    removeEntry: (entryId, base) => submit({ kind: 'entry.removed', entryId, base }),
    undo: (activity) => {
      if (activity.undo !== null) submit(activity.undo);
    },
    markPaid: (transfer) =>
      submit({
        kind: 'entry.put',
        entry: { kind: 'transfer', id: newEntryId(), date: todayLocalDate(), ...transfer },
        base: null,
      }),
    addMember: (name) => {
      const member = { id: newMemberId(), name: name.trim(), paynowMobile: null, archived: false };
      submit({ kind: 'member.put', member });
      return member.id;
    },
    updateMember: (member) => submit({ kind: 'member.put', member }),
    mergeMembers: (from, into) => submit({ kind: 'member.merged', from, into }),
    claim: (memberId) => submit({ kind: 'member.claimed', memberId }),
    rename: (name) => submit({ kind: 'group.renamed', name: name.trim() }),
  };
}
