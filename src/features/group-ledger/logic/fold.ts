import type { CurrencyCode } from '@shared/constants';
import type {
  Activity,
  ActivityWhat,
  Change,
  Entry,
  EntryId,
  ExpenseBasis,
  GroupLog,
  Ledger,
  Member,
  MemberId,
  OpId,
  UserId,
} from '@features/group-ledger/domain/types';
import { asMemberId, byCodeUnit } from '@features/group-ledger/logic/ids';

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

  const resolve = (id: MemberId) => resolveAlias(state.aliases, id);
  const liveMember = (id: MemberId | null): MemberId | null => {
    if (id === null) return null;
    return state.members.has(resolve(id)) ? resolve(id) : null;
  };
  const current = (entry: Entry) =>
    state.aliases.size === 0 ? entry : resolveEntry(entry, resolve);

  return {
    groupId: log.groupId,
    name: state.group.name,
    currency: state.group.currency,
    members: [...state.members.values()],
    entries: [...state.entries.values()]
      .sort((a, b) => byCodeUnit(b.entry.date, a.entry.date) || b.position - a.position)
      .map(({ entry, rev, pending }) => ({ entry: current(entry), rev, pending })),
    me: liveMember(state.claims.get(me) ?? null),
    claimed: new Set([...state.claims.values()].map(liveMember).filter((id) => id !== null)),
    activity: activity
      .map((row) => ({
        ...row,
        by: row.by === null ? null : resolve(row.by),
        what: resolveWhat(row.what, current),
        replaced: row.replaced === null ? null : current(row.replaced),
      }))
      .reverse(),
  };
}

function resolveWhat(what: ActivityWhat, current: (entry: Entry) => Entry): ActivityWhat {
  switch (what.kind) {
    case 'entry-added':
    case 'entry-removed':
    case 'entry-restored':
      return { ...what, entry: current(what.entry) };
    case 'entry-changed':
      return { ...what, before: current(what.before), after: current(what.after) };
    default:
      return what;
  }
}

/**
 * The entry as it reads after every merge: each merged-away member id becomes the member it
 * merged into, adding up what the two had, so screens and the edit form only meet live ids.
 */
function resolveEntry(entry: Entry, resolve: (id: MemberId) => MemberId): Entry {
  if (entry.kind === 'transfer') {
    return { ...entry, from: resolve(entry.from), to: resolve(entry.to) };
  }
  const payer = resolve(entry.payment.payer);
  const others = resolveKeys(entry.payment.others, resolve);
  delete others[payer];
  return {
    ...entry,
    owed: resolveKeys(entry.owed, resolve),
    payment: { payer, others },
    basis: resolveBasis(entry.basis, resolve),
  };
}

function resolveBasis(basis: ExpenseBasis, resolve: (id: MemberId) => MemberId): ExpenseBasis {
  switch (basis.kind) {
    case 'weights':
      return { kind: 'weights', weights: resolveKeys(basis.weights, resolve) };
    case 'amounts':
      return basis;
    case 'receipt':
      return {
        kind: 'receipt',
        receipt: {
          ...basis.receipt,
          items: basis.receipt.items.map((item) => ({
            ...item,
            assignment: {
              ...item.assignment,
              shares: resolveKeys(item.assignment.shares, (id) => resolve(asMemberId(id))),
            },
          })),
        },
      };
    default:
      return basis satisfies never;
  }
}

function resolveKeys<K extends string>(
  amounts: Record<K, number>,
  resolve: (id: K) => K,
): Record<K, number> {
  const resolved = {} as Record<K, number>;
  for (const id of Object.keys(amounts) as K[]) {
    resolved[resolve(id)] = (resolved[resolve(id)] ?? 0) + amounts[id];
  }
  return resolved;
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
