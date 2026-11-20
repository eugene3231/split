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
  MemberId,
  OpId,
  UserId,
} from '@features/group-ledger/domain/types';
import {
  settleClaimsAfterMerge,
  stepClaim,
  type ClaimBook,
} from '@features/group-ledger/logic/claims';
import { ABSENT, stepEntry, type EntryState } from '@features/group-ledger/logic/entryLifecycle';
import { asMemberId, byCodeUnit } from '@features/group-ledger/logic/ids';
import {
  activeMember,
  activeMembers,
  hasMerges,
  resolveMember,
  stepMembers,
  type MemberBook,
} from '@features/group-ledger/logic/memberLifecycle';

const THIS_DEVICE: unique symbol = Symbol('this device');
type Author = UserId | typeof THIS_DEVICE;

interface Op {
  id: OpId;
  at: string;
  change: Change | null;
  author: Author;
  pending: boolean;
}

interface Folding {
  group: { name: string; currency: CurrencyCode } | null;
  members: MemberBook;
  claims: ClaimBook<Author>;
  entries: Map<EntryId, EntryState>;
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
    claims: new Map(),
    entries: new Map(),
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

  const { members } = state;
  const resolve = (id: MemberId) => resolveMember(members, id);
  const liveMember = (id: MemberId | null): MemberId | null => {
    if (id === null) return null;
    return activeMember(members, resolve(id)) === null ? null : resolve(id);
  };
  const merged = hasMerges(members);
  const current = (entry: Entry) => (merged ? resolveEntry(entry, resolve) : entry);

  return {
    groupId: log.groupId,
    name: state.group.name,
    currency: state.group.currency,
    members: activeMembers(members),
    entries: [...state.entries.values()]
      .filter((head) => head.kind === 'live')
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
    case 'member.put':
    case 'member.merged': {
      const step = stepMembers(
        state.members,
        change.kind === 'member.put'
          ? { kind: 'put', member: change.member }
          : { kind: 'merge', from: change.from, into: change.into },
      );
      if (step === null) return null;
      state.members = step.book;
      state.claims = settleClaimsAfterMerge(state.claims, (id) => resolveMember(state.members, id));
      return { what: step.what, replaced: null, undo: step.undo };
    }
    case 'member.claimed': {
      const resolve = (id: MemberId) => resolveMember(state.members, id);
      const claims = stepClaim(state.claims, op.author, change.memberId, resolve);
      if (claims === null) return null;
      state.claims = claims;
      const member =
        change.memberId === null ? null : activeMember(state.members, resolve(change.memberId));
      return plain({ kind: 'member-claimed', member });
    }
    case 'entry.put':
    case 'entry.removed': {
      const entryId = change.kind === 'entry.put' ? change.entry.id : change.entryId;
      const step = stepEntry(
        state.entries.get(entryId) ?? ABSENT,
        change.kind === 'entry.put'
          ? {
              kind: 'put',
              entry: change.entry,
              base: change.base,
              op: op.id,
              pending: op.pending,
              position,
            }
          : { kind: 'remove', base: change.base, op: op.id },
      );
      if (step === null) return null;
      state.entries.set(entryId, step.state);
      return { what: step.what, replaced: step.replaced, undo: step.undo };
    }
    default:
      return change satisfies never;
  }
}

function plain(what: Activity['what']): Outcome {
  return { what, replaced: null, undo: null };
}
