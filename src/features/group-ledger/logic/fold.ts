import type { CurrencyCode } from '@shared/constants';
import type {
  Activity,
  Change,
  Entry,
  EntryId,
  GroupLog,
  Ledger,
  Member,
  MemberId,
  OpId,
  UserId,
} from '@features/group-ledger/domain/types';
import { byCodeUnit } from '@features/group-ledger/logic/ids';

const THIS_DEVICE: unique symbol = Symbol('this device');
type Author = UserId | typeof THIS_DEVICE;

interface Op {
  id: OpId;
  at: string;
  change: Change | null;
  author: Author;
  pending: boolean;
}

interface Head {
  entry: Entry;
  rev: OpId;
  pending: boolean;
  position: number;
}

interface Removed {
  entry: Entry;
  by: OpId;
  position: number;
}

interface Folding {
  group: { name: string; currency: CurrencyCode } | null;
  members: Map<MemberId, Member>;
  aliases: Map<MemberId, MemberId>;
  claims: Map<Author, MemberId | null>;
  entries: Map<EntryId, Head>;
  removed: Map<EntryId, Removed>;
}

type Outcome = Pick<Activity, 'what' | 'replaced' | 'undo'>;

/**
 * Reads a group's log into what the screens show. Confirmed ops come first, in `seq` order, then
 * this device's pending ops in `order` order, as if written by `self`. A pending op this version
 * cannot read shows as unknown, like a confirmed one. Null until the log holds
 * the op that created the group.
 *
 * An op that changes nothing (a second `group.created`, removing an entry that is already gone,
 * merging a member that is not there, claiming a member someone else holds) leaves no activity
 * row.
 */
export function foldLedger(log: GroupLog, self: UserId | null): Ledger | null {
  const me: Author = self ?? THIS_DEVICE;
  const confirmedIds = new Set(log.confirmed.map((op) => op.id));
  const ops: Op[] = [
    ...log.confirmed
      .toSorted((a, b) => a.seq - b.seq)
      .map(({ id, at, change, userId }): Op => ({
        id,
        at,
        change,
        author: userId,
        pending: false,
      })),
    ...[...log.pending, ...(log.unreadablePending ?? []).map((op) => ({ ...op, change: null }))]
      .filter((op) => !confirmedIds.has(op.id))
      .toSorted((a, b) => a.order - b.order)
      .map(({ id, at, change }): Op => ({ id, at, change, author: me, pending: true })),
  ];

  const state: Folding = {
    group: null,
    members: new Map(),
    aliases: new Map(),
    claims: new Map(),
    entries: new Map(),
    removed: new Map(),
  };
  const activity: Activity[] = [];

  ops.forEach((op, position) => {
    const claimBefore = state.claims.get(op.author) ?? null;
    const outcome = apply(state, op, position);
    if (outcome === null) return;
    activity.push({
      opId: op.id,
      at: op.at,
      by: state.claims.get(op.author) ?? claimBefore,
      pending: op.pending,
      ...outcome,
    });
  });

  if (state.group === null) return null;

  const liveMember = (id: MemberId | null): MemberId | null => {
    if (id === null) return null;
    const resolved = resolveAlias(state.aliases, id);
    return state.members.has(resolved) ? resolved : null;
  };

  return {
    groupId: log.groupId,
    name: state.group.name,
    currency: state.group.currency,
    members: [...state.members.values()],
    aliases: new Map(
      [...state.aliases.keys()].map((from) => [from, resolveAlias(state.aliases, from)]),
    ),
    entries: [...state.entries.values()]
      .sort((a, b) => byCodeUnit(b.entry.date, a.entry.date) || b.position - a.position)
      .map(({ entry, rev, pending }) => ({ entry, rev, pending })),
    me: liveMember(state.claims.get(me) ?? null),
    claimed: new Set([...state.claims.values()].map(liveMember).filter((id) => id !== null)),
    activity: activity
      .map((row) => ({
        ...row,
        by: row.by === null ? null : resolveAlias(state.aliases, row.by),
      }))
      .reverse(),
  };
}

function apply(state: Folding, op: Op, position: number): Outcome | null {
  const { change } = op;
  if (change?.kind === 'group.created') {
    if (state.group !== null) return null;
    state.group = { name: change.name, currency: change.currency };
    return plain({ kind: 'group-created', name: change.name });
  }
  const group = state.group;
  if (group === null) return null;
  if (change === null) return plain({ kind: 'unknown' });

  switch (change.kind) {
    case 'group.renamed': {
      const from = group.name;
      group.name = change.name;
      return {
        what: { kind: 'group-renamed', from, to: change.name },
        replaced: null,
        undo: { kind: 'group.renamed', name: from },
      };
    }
    case 'member.put': {
      const { member } = change;
      if (state.aliases.has(member.id)) return null;
      const before = state.members.get(member.id);
      state.members.set(member.id, member);
      if (before === undefined) return plain({ kind: 'member-added', member });
      return {
        what: { kind: 'member-changed', before, after: member },
        replaced: null,
        undo: { kind: 'member.put', member: before },
      };
    }
    case 'member.merged': {
      const fromId = resolveAlias(state.aliases, change.from);
      const intoId = resolveAlias(state.aliases, change.into);
      const from = state.members.get(fromId);
      const into = state.members.get(intoId);
      if (fromId === intoId || from === undefined || into === undefined) return null;
      state.aliases.set(fromId, intoId);
      state.members.delete(fromId);
      return plain({ kind: 'member-merged', from, into });
    }
    case 'member.claimed': {
      const claimed =
        change.memberId === null ? null : resolveAlias(state.aliases, change.memberId);
      if (claimed !== null && isHeldByAnother(state, claimed, op.author)) return null;
      state.claims.set(op.author, change.memberId);
      const member = claimed === null ? null : (state.members.get(claimed) ?? null);
      return plain({ kind: 'member-claimed', member });
    }
    case 'entry.put': {
      const { entry, base } = change;
      const head = state.entries.get(entry.id);
      const removed = state.removed.get(entry.id);
      state.removed.delete(entry.id);
      state.entries.set(entry.id, {
        entry,
        rev: op.id,
        pending: op.pending,
        position: head?.position ?? removed?.position ?? position,
      });
      const remove: Change = { kind: 'entry.removed', entryId: entry.id, base: op.id };

      if (head !== undefined) {
        return {
          what: { kind: 'entry-changed', before: head.entry, after: entry },
          replaced: base === head.rev ? null : head.entry,
          undo: { kind: 'entry.put', entry: head.entry, base: op.id },
        };
      }
      if (removed === undefined) {
        return { what: { kind: 'entry-added', entry }, replaced: null, undo: remove };
      }
      if (base === removed.by) {
        return { what: { kind: 'entry-restored', entry }, replaced: null, undo: remove };
      }
      return {
        what: { kind: 'entry-changed', before: removed.entry, after: entry },
        replaced: removed.entry,
        undo: remove,
      };
    }
    case 'entry.removed': {
      const head = state.entries.get(change.entryId);
      if (head === undefined) return null;
      state.entries.delete(change.entryId);
      state.removed.set(change.entryId, {
        entry: head.entry,
        by: op.id,
        position: head.position,
      });
      return {
        what: { kind: 'entry-removed', entry: head.entry },
        replaced: change.base === head.rev ? null : head.entry,
        undo: { kind: 'entry.put', entry: head.entry, base: op.id },
      };
    }
    default:
      return change satisfies never;
  }
}

function isHeldByAnother(state: Folding, member: MemberId, author: Author): boolean {
  return [...state.claims].some(
    ([holder, held]) =>
      holder !== author && held !== null && resolveAlias(state.aliases, held) === member,
  );
}

function plain(what: Activity['what']): Outcome {
  return { what, replaced: null, undo: null };
}

function resolveAlias(aliases: ReadonlyMap<MemberId, MemberId>, id: MemberId): MemberId {
  let current = id;
  for (let next = aliases.get(current); next !== undefined; next = aliases.get(current)) {
    current = next;
  }
  return current;
}
